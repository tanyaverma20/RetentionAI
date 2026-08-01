import os
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Header, BackgroundTasks, status
import asyncio
import hashlib

from app.nlp.schemas import (
    NLPAnalyzeRequest,
    NLPBatchAnalyzeRequest,
    NLPInsightsResponse,
    NLPBatchResponse,
    DashboardStatistics
)
from app.nlp.preprocessing import clean_text
from app.nlp.analyzer import analyze_hr_text, detect_language, SUPPORTED_LANGUAGE
from app.nlp.repository import (
    save_insight,
    save_insights_batch,
    get_employee_insights,
    get_dashboard_statistics,
    find_cached_insight,
)

router = APIRouter(prefix="/nlp", tags=["NLP"])

# How long a single text's NLP pipeline (VADER + 2 transformer models + spaCy)
# may run before we give up and return a clear timeout error instead of
# hanging the request indefinitely.
INFERENCE_TIMEOUT_SECONDS = float(os.getenv("NLP_INFERENCE_TIMEOUT_SECONDS", "30"))


# Mirrors verify_auth_token in routes.py / explain_routes.py /
# employee_intelligence_routes.py — this router was missing it entirely,
# leaving raw employee sentiment/burnout read+write reachable with no auth.
async def verify_auth_token(authorization: Optional[str] = Header(None)):
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

def _text_hash(text: str) -> str:
    return hashlib.sha256((text or "").encode("utf-8")).hexdigest()

async def process_single_record(record: NLPAnalyzeRequest) -> NLPInsightsResponse:
    if not record.text or not record.text.strip():
        raise HTTPException(status_code=400, detail="Text is required and cannot be empty.")

    detected_lang = detect_language(record.text)
    if detected_lang not in (SUPPORTED_LANGUAGE, "unknown"):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported language detected ('{detected_lang}'). Only English text is currently supported.",
        )

    text_hash = _text_hash(record.text)

    # Caching: skip recomputation if this exact source document's text hasn't
    # changed since it was last analyzed.
    cached = await find_cached_insight(record.sourceDocumentId, text_hash)
    if cached:
        return NLPInsightsResponse(**{k: v for k, v in cached.items() if k != "_id" and k != "textHash"})

    cleaned_text = clean_text(record.text)

    # Run the (synchronous, CPU-bound) NLP pipeline in a thread so it doesn't
    # block the event loop, with an explicit timeout so a pathological input
    # can't hang the request forever.
    loop = asyncio.get_event_loop()
    try:
        analysis = await asyncio.wait_for(
            loop.run_in_executor(None, analyze_hr_text, record.text, cleaned_text),
            timeout=INFERENCE_TIMEOUT_SECONDS,
        )
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="NLP inference timed out. Please try again.")

    return NLPInsightsResponse(
        employeeId=record.employeeId,
        sourceCollection=record.sourceCollection,
        sourceDocumentId=record.sourceDocumentId,
        sentiment=analysis["sentiment"],
        sentimentScore=analysis["sentimentScore"],
        detectedEmotions=analysis["detectedEmotions"],
        dominantEmotion=analysis["dominantEmotion"],
        detectedTopics=analysis["detectedTopics"],
        extractedKeywords=analysis["extractedKeywords"],
        burnoutRisk=analysis["burnoutRisk"],
        burnoutLevel=analysis["burnoutLevel"],
        resignationIntent=analysis["resignationIntent"],
        engagementRisk=analysis["engagementRisk"],
        promotionFrustration=analysis["promotionFrustration"],
        managerConflict=analysis["managerConflict"],
        confidence=analysis["confidence"],
        summary=analysis["summary"],
        generatedAt=analysis["generatedAt"]
    )

@router.post("/analyze", response_model=NLPInsightsResponse, dependencies=[Depends(verify_auth_token)])
async def analyze_text(request: NLPAnalyzeRequest, background_tasks: BackgroundTasks):
    """
    Analyzes a single text record and saves the result to MongoDB.
    """
    try:
        insight = await process_single_record(request)

        # Save to DB in background so API is fast. textHash is stored alongside
        # the insight so a future call with unchanged text can be served from cache.
        payload = insight.model_dump()
        payload["textHash"] = _text_hash(request.text)
        background_tasks.add_task(save_insight, payload)

        return insight
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"NLP Analysis failed: {str(e)}")

@router.post("/analyze/batch", response_model=NLPBatchResponse, dependencies=[Depends(verify_auth_token)])
async def analyze_batch(request: NLPBatchAnalyzeRequest, background_tasks: BackgroundTasks):
    """
    Analyzes a batch of text records.
    Ideal for processing historical data or daily syncs.

    One bad record (empty text, unsupported language, a timeout) is skipped
    rather than aborting the whole batch — mirrors /predict/batch and
    /explain/batch's per-item error isolation.
    """
    insights = []
    payloads = []
    for record in request.records:
        try:
            insight = await process_single_record(record)
        except HTTPException as exc:
            print(f"Skipping record {record.sourceDocumentId}: {exc.detail}")
            continue
        insights.append(insight)
        payload = insight.model_dump()
        payload["textHash"] = _text_hash(record.text)
        payloads.append(payload)

    # Save batch in background
    background_tasks.add_task(save_insights_batch, payloads)

    return NLPBatchResponse(
        success=True,
        processedCount=len(insights),
        insights=insights
    )

@router.get("/employee/{employeeId}", response_model=List[NLPInsightsResponse], dependencies=[Depends(verify_auth_token)])
async def get_employee_nlp_insights(employeeId: str):
    """
    Retrieves all stored NLP insights for a given employee.
    """
    try:
        results = await get_employee_insights(employeeId)
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch insights: {str(e)}")

@router.get("/dashboard", response_model=DashboardStatistics, dependencies=[Depends(verify_auth_token)])
async def get_nlp_dashboard():
    """
    Retrieves aggregated NLP statistics for the HR dashboard.
    """
    try:
        stats = await get_dashboard_statistics()
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch dashboard stats: {str(e)}")

@router.get("/statistics", response_model=DashboardStatistics, dependencies=[Depends(verify_auth_token)])
async def get_nlp_statistics():
    """
    Alias for dashboard stats.
    """
    try:
        stats = await get_dashboard_statistics()
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch statistics: {str(e)}")
