"""
employee_intelligence_routes.py
================================
FastAPI router for the Employee Intelligence (NLP) sprint.

Endpoints
---------
POST /sentiment                        — lightweight, ad-hoc sentiment only
POST /sentiment/batch                  — batch ad-hoc sentiment only
POST /employee-intelligence            — full pipeline, aggregated across one
                                          employee's Feedback/Survey/ManagerNote text
GET  /employee-intelligence/{id}       — same aggregation, GET convenience form
GET  /employee-intelligence/dashboard  — workforce-wide NLP statistics

Design notes
------------
This module is intentionally source-agnostic: `_collect_employee_texts` reads
from whichever Mongo collections currently hold employee-generated text
(Employee Feedback, Survey comments, Manager Notes) and stitches them into a
single (source_collection, source_document_id, text) list. Adding a future
text source (e.g. Exit Interview Notes) only requires adding one entry to
`_TEXT_SOURCES` — no pipeline/aggregation code needs to change.

This service computes fresh (stateless) — it does not write the aggregated
Employee Intelligence profile to Mongo itself. Persistence/history for the
aggregated profile is owned by Express (`server/src/models/EmployeeIntelligence.js`),
mirroring the SHAP explainability sprint's split between FastAPI (compute) and
Express (cache + history). Per-text raw insights are still written to the
`nlp_insights` collection by `/nlp/analyze` as before.
"""

from __future__ import annotations

import asyncio
import collections
import datetime
import os
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Header, status

from app.api.employee_intelligence_schemas import (
    EmployeeIntelligenceBatchRequest,
    EmployeeIntelligenceBatchResponse,
    EmployeeIntelligenceRequest,
    EmployeeIntelligenceResponse,
    SentimentBatchRequest,
    SentimentBatchResponse,
    SentimentRequest,
    SentimentResult,
)
from app.nlp.analyzer import (
    analyze_sentiment,
    analyze_hr_text,
    analyze_hr_texts_batch,
    burnout_level,
    detect_language,
    dominant_emotion,
    generate_summary,
    SUPPORTED_LANGUAGE,
)
from app.nlp.preprocessing import clean_text
from app.nlp.repository import get_dashboard_statistics
from app.nlp.schemas import DashboardStatistics
from app.utils.database import get_db

router = APIRouter(tags=["Employee Intelligence"])

# Same timeout budget as /nlp/analyze — a single text's pipeline run must
# finish within this window or the request fails cleanly with a 504.
INFERENCE_TIMEOUT_SECONDS = float(os.getenv("NLP_INFERENCE_TIMEOUT_SECONDS", "30"))


# ---------------------------------------------------------------------------
# Auth (mirrors verify_auth_token in routes.py / explain_routes.py)
# ---------------------------------------------------------------------------

async def verify_auth_token(authorization: Optional[str] = Header(None)):
    import os
    expected = os.getenv("AI_SERVICE_TOKEN")
    if not expected or expected == "replace-with-a-service-token":
        return True
    if not authorization:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing Authorization header")
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid Authorization header format")
    if parts[1] != expected:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")
    return True


# ---------------------------------------------------------------------------
# Source-agnostic text collection
# ---------------------------------------------------------------------------

# Each entry: (Mongo collection name, list of text field(s) to pull from it,
# a label used for source-attribution). Add a new tuple here to support a new
# text source (e.g. exit interviews) with no other code changes.
_TEXT_SOURCES = [
    ("employeefeedbacks", ["feedbackText"], "employee_feedback"),
    ("surveys", ["surveyComments"], "employee_surveys"),
    ("managernotes", ["observation", "recommendation"], "manager_notes"),
]


async def _analyze_text_safe(text: str) -> Optional[dict]:
    """
    Runs the (synchronous, CPU-bound) NLP pipeline off the event loop with a
    timeout, skipping text that's empty or in an unsupported language.
    Returns None (never raises) so a single bad text can't fail an
    employee's whole aggregated profile or a batch run.
    """
    if not text or not text.strip():
        return None
    if detect_language(text) not in (SUPPORTED_LANGUAGE, "unknown"):
        return None
    try:
        cleaned = clean_text(text)
        loop = asyncio.get_event_loop()
        return await asyncio.wait_for(
            loop.run_in_executor(None, analyze_hr_text, text, cleaned),
            timeout=INFERENCE_TIMEOUT_SECONDS,
        )
    except asyncio.TimeoutError:
        print("NLP inference timed out on one text record — skipping it.")
        return None
    except Exception as exc:
        print(f"Failed to analyze a text record: {exc}")
        return None


async def _collect_employee_texts(db, employee_id: ObjectId) -> list[dict]:
    """Returns a list of {sourceCollection, sourceDocumentId, text} for one employee."""
    texts: list[dict] = []
    for collection_name, fields, source_label in _TEXT_SOURCES:
        cursor = db[collection_name].find({"employeeId": employee_id})
        async for doc in cursor:
            for field in fields:
                value = doc.get(field)
                if value and isinstance(value, str) and value.strip():
                    texts.append({
                        "sourceCollection": source_label,
                        "sourceDocumentId": str(doc["_id"]),
                        "text": value,
                    })
    return texts


async def _collect_texts_bulk(db, employee_ids: list[ObjectId]) -> dict[str, list[str]]:
    """
    Bulk equivalent of _collect_employee_texts for the batch endpoint: returns
    {employeeIdStr: [text, ...]} for every requested employee.

    _collect_employee_texts issues one query PER SOURCE PER EMPLOYEE — with 3
    sources and 1254 active employees that is 3,762 sequential round-trips,
    every one of them awaited in turn. This issues exactly len(_TEXT_SOURCES)
    queries total, each an indexed $in over the whole employee set, and keeps
    the same source-agnostic contract: adding a tuple to _TEXT_SOURCES still
    requires no changes here.
    """
    by_employee: dict[str, list[str]] = {str(eid): [] for eid in employee_ids}

    for collection_name, fields, _source_label in _TEXT_SOURCES:
        projection = {"employeeId": 1, **{f: 1 for f in fields}}
        cursor = db[collection_name].find({"employeeId": {"$in": employee_ids}}, projection)
        async for doc in cursor:
            key = str(doc.get("employeeId"))
            bucket = by_employee.get(key)
            if bucket is None:
                continue
            for field in fields:
                value = doc.get(field)
                if value and isinstance(value, str) and value.strip():
                    bucket.append(value)

    return by_employee


def _analyze_unique_texts(texts: list[str]) -> dict[str, dict]:
    """
    Runs the NLP pipeline once per DISTINCT text and returns {text: analysis}.

    Synchronous and CPU-bound — call via asyncio.to_thread.

    Two multipliers are removed here. First, deduplication: the analysis is a
    pure function of the text, so identical strings cannot produce different
    results. The seeded corpus is 2,778 text records drawn from just 20
    distinct strings (a 139x redundancy factor), and re-running the models on
    a string already analyzed is wasted work regardless of the corpus.
    Second, batching: analyze_hr_texts_batch feeds the transformers a list so
    HuggingFace pads and batches the forward passes.

    Language gating matches _analyze_text_safe — non-English text is dropped
    (mapped to None) rather than fed to English-only models.
    """
    analyzable = [t for t in texts if detect_language(t) in (SUPPORTED_LANGUAGE, "unknown")]

    results: dict[str, dict] = {t: None for t in texts}
    if not analyzable:
        return results

    try:
        for text, analysis in zip(analyzable, analyze_hr_texts_batch(analyzable)):
            results[text] = analysis
    except Exception as exc:
        # Preserve the per-text isolation _analyze_text_safe gave us: if the
        # batched call fails for any reason, fall back to analyzing one at a
        # time so a single pathological text can't void the whole run.
        print(f"Batched NLP analysis failed ({exc}) — falling back to per-text.")
        for text in analyzable:
            try:
                results[text] = analyze_hr_text(text, clean_text(text))
            except Exception as inner:
                print(f"Failed to analyze a text record: {inner}")

    return results


def _aggregate_employee_intelligence(employee_id: str, analyses: list[dict]) -> dict:
    """Combines per-text analyze_hr_text() outputs into one employee-level profile."""
    if not analyses:
        return {
            "employeeId": employee_id,
            "sentiment": "Neutral",
            "sentimentScore": 0.5,
            "emotion": "Satisfied",
            "emotionBreakdown": {},
            "burnoutRisk": "Low",
            "burnoutScore": 0.0,
            "topics": [],
            "keywords": [],
            "confidence": 0.0,
            "summary": "No employee-generated text is available yet for this employee — Employee Intelligence will populate once feedback, survey, or manager-note text exists.",
            "dataPoints": 0,
            "generatedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        }

    avg_sentiment_score = sum(a["sentimentScore"] for a in analyses) / len(analyses)
    overall_sentiment = "Positive" if avg_sentiment_score > 0.6 else "Negative" if avg_sentiment_score < 0.4 else "Neutral"

    emotion_totals: dict[str, float] = collections.defaultdict(float)
    for a in analyses:
        for emo, score in a["detectedEmotions"].items():
            emotion_totals[emo] += score
    emotion_breakdown = {k: round(v / len(analyses), 2) for k, v in emotion_totals.items()}
    emotion = dominant_emotion(emotion_breakdown)

    avg_burnout_score = sum(a["burnoutRisk"] for a in analyses) / len(analyses)
    burnout = burnout_level(avg_burnout_score)

    topic_counts = collections.Counter()
    keyword_counts = collections.Counter()
    for a in analyses:
        topic_counts.update([t for t in a["detectedTopics"] if t != "Other"])
        keyword_counts.update(a["extractedKeywords"])

    top_topics = [t for t, _ in topic_counts.most_common(5)]
    top_keywords = [k for k, _ in keyword_counts.most_common(10)]

    avg_confidence = round(sum(a["confidence"] for a in analyses) / len(analyses), 2)

    summary = generate_summary(
        {"label": overall_sentiment, "score": avg_sentiment_score},
        emotion,
        burnout,
        top_topics,
    )

    return {
        "employeeId": employee_id,
        "sentiment": overall_sentiment,
        "sentimentScore": round(avg_sentiment_score, 2),
        "emotion": emotion,
        "emotionBreakdown": emotion_breakdown,
        "burnoutRisk": burnout,
        "burnoutScore": round(avg_burnout_score, 2),
        "topics": top_topics,
        "keywords": top_keywords,
        "confidence": avg_confidence,
        "summary": summary,
        "dataPoints": len(analyses),
        "generatedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    }


async def _build_employee_intelligence(employee_id_str: str) -> dict:
    try:
        obj_id = ObjectId(employee_id_str)
    except Exception:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Invalid employeeId: {employee_id_str}")

    db = get_db()
    if db is None:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Database unavailable")

    employee = await db["employees"].find_one({"_id": obj_id, "isDeleted": {"$ne": True}})
    if not employee:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Employee {employee_id_str} not found")

    text_records = await _collect_employee_texts(db, obj_id)

    analyses = []
    for record in text_records:
        analysis = await _analyze_text_safe(record["text"])
        if analysis is not None:
            analyses.append(analysis)

    return _aggregate_employee_intelligence(employee_id_str, analyses)


# ---------------------------------------------------------------------------
# POST /sentiment
# ---------------------------------------------------------------------------

@router.post("/sentiment", response_model=SentimentResult, dependencies=[Depends(verify_auth_token)])
async def sentiment_single(request: SentimentRequest):
    if not request.text or not request.text.strip():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Text is required and cannot be empty.")
    detected_lang = detect_language(request.text)
    if detected_lang not in (SUPPORTED_LANGUAGE, "unknown"):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Unsupported language detected ('{detected_lang}'). Only English text is currently supported.",
        )
    result = analyze_sentiment(request.text)
    return SentimentResult(text=request.text, sentiment=result["label"], sentimentScore=round(result["score"], 2))


# ---------------------------------------------------------------------------
# POST /sentiment/batch
# ---------------------------------------------------------------------------

@router.post("/sentiment/batch", response_model=SentimentBatchResponse, dependencies=[Depends(verify_auth_token)])
async def sentiment_batch(request: SentimentBatchRequest):
    results = []
    for text in request.texts:
        if not text or not text.strip():
            continue
        if detect_language(text) not in (SUPPORTED_LANGUAGE, "unknown"):
            continue
        result = analyze_sentiment(text)
        results.append(SentimentResult(text=text, sentiment=result["label"], sentimentScore=round(result["score"], 2)))
    return SentimentBatchResponse(success=True, results=results)


# ---------------------------------------------------------------------------
# POST /employee-intelligence
# ---------------------------------------------------------------------------

@router.post(
    "/employee-intelligence",
    response_model=EmployeeIntelligenceResponse,
    dependencies=[Depends(verify_auth_token)],
)
async def employee_intelligence_generate(request: EmployeeIntelligenceRequest):
    result = await _build_employee_intelligence(request.employeeId)
    return EmployeeIntelligenceResponse(**result)


# ---------------------------------------------------------------------------
# POST /employee-intelligence/batch
#
# Analyzes multiple employees in one call (explicit list, a department, or —
# with neither filter — every ACTIVE employee), mirroring /predict/batch and
# /explain/batch's filtering shape and per-item error isolation. This is what
# populates the Dashboard's Employee Intelligence widgets in one action
# instead of requiring a profile-by-profile visit.
# ---------------------------------------------------------------------------

@router.post(
    "/employee-intelligence/batch",
    response_model=EmployeeIntelligenceBatchResponse,
    dependencies=[Depends(verify_auth_token)],
)
async def employee_intelligence_batch(request: EmployeeIntelligenceBatchRequest):
    db = get_db()
    if db is None:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Database unavailable")

    query: dict = {"isDeleted": {"$ne": True}}
    if request.employeeIds:
        try:
            query["_id"] = {"$in": [ObjectId(eid) for eid in request.employeeIds]}
        except Exception:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "One or more employee IDs are invalid ObjectIds")
    elif request.departmentId:
        try:
            query["departmentId"] = ObjectId(request.departmentId)
        except Exception:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Invalid departmentId format: {request.departmentId}")
    else:
        query["status"] = "ACTIVE"

    employee_oids = [emp["_id"] async for emp in db["employees"].find(query, {"_id": 1})]

    # Root cause of the "Generate Employee Intelligence" 503
    # (AI_SERVICE_UNAVAILABLE): this used to loop employee-by-employee, and
    # inside each employee, text-by-text — 3 Mongo queries plus a full
    # single-text NLP pipeline run per record, all sequentially awaited.
    # Measured directly against this endpoint: 81.5s for 5 employees (13 text
    # records) = 6.27s per text, which over the full 1254-employee / 2778-record
    # workforce is ~4.9 HOURS. Express's 30s axios timeout fired long before
    # FastAPI got anywhere, and a response-less axios error maps to
    # AI_SERVICE_UNAVAILABLE — the service was never actually down.
    #
    # Three fixes, in order of impact:
    #   1. Analyze each DISTINCT text once (2778 records -> 20 unique strings).
    #   2. Batch the transformer forward passes (zero-shot was 89% of runtime).
    #   3. Bulk-fetch all text in 3 queries instead of 3,762.
    # The per-employee aggregation itself is pure Python over already-computed
    # analyses, so it stays a plain loop.
    #
    # The single-employee endpoints below are deliberately untouched — they
    # analyze a handful of records and already respond in well under a second.
    texts_by_employee = await _collect_texts_bulk(db, employee_oids)

    distinct_texts = list({t for texts in texts_by_employee.values() for t in texts})
    analysis_by_text = await asyncio.to_thread(_analyze_unique_texts, distinct_texts)

    profiles = []
    failed_count = 0
    for employee_id in (str(oid) for oid in employee_oids):
        try:
            analyses = [
                analysis
                for text in texts_by_employee.get(employee_id, [])
                if (analysis := analysis_by_text.get(text)) is not None
            ]
            profiles.append(_aggregate_employee_intelligence(employee_id, analyses))
        except Exception as exc:
            print(f"Failed to build Employee Intelligence for {employee_id}: {exc}")
            failed_count += 1

    return EmployeeIntelligenceBatchResponse(
        success=True,
        profiles=[EmployeeIntelligenceResponse(**p) for p in profiles],
        totalCount=len(employee_oids),
        successCount=len(profiles),
        failedCount=failed_count,
    )


# ---------------------------------------------------------------------------
# GET /employee-intelligence/dashboard
#
# Registered BEFORE the /{employeeId} route below: FastAPI matches path
# operations in registration order, and "dashboard" would otherwise be
# swallowed as an employeeId path parameter.
# ---------------------------------------------------------------------------

@router.get(
    "/employee-intelligence/dashboard",
    response_model=DashboardStatistics,
    dependencies=[Depends(verify_auth_token)],
)
async def employee_intelligence_dashboard():
    stats = await get_dashboard_statistics()
    return DashboardStatistics(**stats)


# ---------------------------------------------------------------------------
# GET /employee-intelligence/{employeeId}
# ---------------------------------------------------------------------------

@router.get(
    "/employee-intelligence/{employeeId}",
    response_model=EmployeeIntelligenceResponse,
    dependencies=[Depends(verify_auth_token)],
)
async def employee_intelligence_get(employeeId: str):
    result = await _build_employee_intelligence(employeeId)
    return EmployeeIntelligenceResponse(**result)
