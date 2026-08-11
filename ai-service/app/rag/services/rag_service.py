"""
app/rag/services/rag_service.py
================================
Business logic layer for the Knowledge Intelligence (RAG) module.
- Orchestrates document loading, cleaning, chunking, indexing, and querying.
- Logs all RAG queries to MongoDB for audit and analytics.

Grounding guarantee
--------------------
query_rag() NEVER calls the LLM when zero relevant chunks are retrieved —
this is a hard code-level guard, not just a prompt instruction the model
could ignore, so "never answer from model knowledge when no supporting
documents are available" holds even if the LLM doesn't perfectly follow
its system prompt.
"""

import asyncio
import datetime
import os
import time
from typing import Any, Dict, List, Optional

from app.rag.chunkers.text_chunker import split_documents
from app.rag.cleaners.text_cleaner import clean_document_text
from app.rag.chains.rag_chain import get_llm
from app.rag.loaders.document_loader import load_documents, load_single_document
from app.rag.prompts.rag_prompt import prompt_template
from app.rag.security.sanitizer import wrap_as_untrusted_document
from app.rag.vectorstore.chroma_store import (
    clear_vectorstore,
    delete_document_chunks,
    get_vectorstore,
    index_documents,
)
from app.utils.database import get_db

# Fixed, server-controlled directory for legacy bulk (re)indexing — never
# parameterizable from a request (see the docstring on load_documents()).
KNOWLEDGE_BASE_DIR = os.path.join(
    os.path.dirname(__file__), "../../../knowledge_base"
)

# How long a single LLM call may run before the request fails cleanly
# instead of hanging. Also passed to ChatGroq itself in rag_chain.py as a
# second layer of protection.
RAG_LLM_TIMEOUT_SECONDS = float(os.getenv("RAG_LLM_TIMEOUT_SECONDS", "30"))

# Below this relevance score, a retrieved chunk is treated as noise rather
# than real grounding evidence.
MIN_RELEVANCE_SCORE = float(os.getenv("RAG_MIN_RELEVANCE_SCORE", "0.15"))

_NOT_AVAILABLE_ANSWER = "The answer is not available in the company's policy documents."


# ---------------------------------------------------------------------------
# Cleaning + chunking helpers (shared by upload, single-document reindex, and
# legacy bulk (re)indexing)
# ---------------------------------------------------------------------------

def _clean_and_chunk(raw_docs):
    for d in raw_docs:
        d.page_content = clean_document_text(d.page_content)
    return split_documents([d for d in raw_docs if d.page_content])


# ---------------------------------------------------------------------------
# Query logging
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# Query logging
# ---------------------------------------------------------------------------

async def log_rag_query(
    query: str,
    response: str,
    sources: List[Dict],
    user_id: str,
    latency_ms: float,
    grounded: bool,
    organization_id: Optional[str] = None,
    groundedness_score: Optional[float] = None,
    retrieval_latency_ms: Optional[float] = None,
    generation_latency_ms: Optional[float] = None,
    citation_count: Optional[int] = 0,
    retrieval_mode: Optional[str] = "hybrid",
):
    """Logs RAG query metadata to MongoDB for analytics."""
    try:
        db = get_db()
        await db["rag_logs"].insert_one({
            "query": query,
            "response": response,
            "retrievedDocuments": [s.get("documentName") for s in sources],
            "grounded": grounded,
            "latencyMs": latency_ms,
            "userId": user_id,
            "organizationId": organization_id,
            "groundednessScore": groundedness_score,
            "retrievalLatencyMs": retrieval_latency_ms,
            "generationLatencyMs": generation_latency_ms,
            "citationCount": citation_count,
            "retrievalMode": retrieval_mode,
            "timestamp": datetime.datetime.now(datetime.timezone.utc),
        })
    except Exception as e:
        print(f"Failed to log RAG query: {e}")


# ---------------------------------------------------------------------------
# Indexing — single document (upload / reindex-one) and legacy bulk
# ---------------------------------------------------------------------------

def index_single_document(file_path: str, document_id: str, metadata: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Loads, cleans, chunks, and indexes ONE file, tagged with documentId and organizationId.
    """
    full_metadata = {"documentId": document_id, **(metadata or {})}
    raw_docs = load_single_document(file_path, full_metadata)
    chunks = _clean_and_chunk(raw_docs)

    org_id = full_metadata.get("organizationId")
    delete_document_chunks(document_id, organization_id=org_id)
    if chunks:
        index_documents(chunks)

    return {
        "success": True,
        "message": f"Indexed {len(chunks)} chunks.",
        "documentsIndexed": 1 if chunks else 0,
        "chunksIndexed": len(chunks),
    }


def index_knowledge_base(directory: str = None, organization_id: str = "60d5ec388832a828f8000000") -> Dict[str, Any]:
    """
    Loads, chunks, and indexes all documents from the fixed knowledge_base directory for an organization.
    """
    kb_dir = directory or KNOWLEDGE_BASE_DIR
    raw_docs = load_documents(kb_dir)

    if not raw_docs:
        return {"success": False, "message": "No documents found.", "documentsIndexed": 0, "chunksIndexed": 0}

    for d in raw_docs:
        d.metadata["organizationId"] = organization_id

    chunks = _clean_and_chunk(raw_docs)
    index_documents(chunks)

    unique_docs = len(set(c.metadata.get("source", "unknown") for c in chunks))

    return {
        "success": True,
        "message": f"Successfully indexed {unique_docs} documents into {len(chunks)} chunks.",
        "documentsIndexed": unique_docs,
        "chunksIndexed": len(chunks),
    }


def reindex_knowledge_base(directory: str = None, organization_id: str = "60d5ec388832a828f8000000") -> Dict[str, Any]:
    """Clears the existing vector store and re-indexes the fixed directory from scratch."""
    try:
        clear_vectorstore()
    except Exception as e:
        print(f"Warning during clear: {e}")

    return index_knowledge_base(directory, organization_id=organization_id)


def delete_document(document_id: str, organization_id: Optional[str] = None) -> Dict[str, Any]:
    """Removes every chunk belonging to one document from the vector store for an organization."""
    delete_document_chunks(document_id, organization_id=organization_id)
    return {"success": True, "message": f"Deleted chunks for document {document_id}."}


# ---------------------------------------------------------------------------
# Retrieval helpers (Dense, BM25 Sparse, and Hybrid Reciprocal Rank Fusion)
# ---------------------------------------------------------------------------

import re
try:
    from rank_bm25 import BM25Okapi
except ImportError:
    BM25Okapi = None
from langchain_core.documents import Document


def _build_filter(organization_id: str, document_type: Optional[str], filter_document: Optional[str]) -> Dict[str, Any]:
    clauses = [{"organizationId": organization_id}]
    if filter_document:
        clauses.append({"source": filter_document})
    if document_type:
        clauses.append({"documentType": document_type})
    if len(clauses) == 1:
        return clauses[0]
    return {"$and": clauses}


def _retrieve(question: str, top_k: int, organization_id: str, document_type: Optional[str], filter_document: Optional[str]):
    if not organization_id or not str(organization_id).strip():
        raise ValueError("Tenant context (organizationId) is required for RAG operations.")
    vectorstore = get_vectorstore()
    filter_dict = _build_filter(organization_id, document_type, filter_document)
    try:
        return vectorstore.similarity_search_with_relevance_scores(question, k=top_k, filter=filter_dict)
    except Exception as e:
        raise RuntimeError(f"Vector database unavailable: {e}")


def _tokenize(text: str) -> List[str]:
    return [w for w in re.findall(r"\w+", (text or "").lower()) if len(w) > 1]


def _sparse_bm25_retrieve(
    question: str,
    top_k: int,
    organization_id: str,
    document_type: Optional[str],
    filter_document: Optional[str]
) -> List[tuple]:
    if not organization_id or not str(organization_id).strip():
        raise ValueError("Tenant context (organizationId) is required for RAG operations.")
    vectorstore = get_vectorstore()
    filter_dict = _build_filter(organization_id, document_type, filter_document)
    data = vectorstore.get(where=filter_dict, include=["metadatas", "documents"])

    docs_raw = data.get("documents", [])
    metas_raw = data.get("metadatas", [])
    if not docs_raw or not BM25Okapi:
        return []

    corpus_tokens = [_tokenize(doc_text) for doc_text in docs_raw]
    query_tokens = _tokenize(question)
    if not query_tokens or not any(corpus_tokens):
        return []

    bm25 = BM25Okapi(corpus_tokens)
    scores = bm25.get_scores(query_tokens)
    max_score = max(scores) if len(scores) > 0 and max(scores) > 0 else 1.0

    doc_score_pairs = []
    for doc_text, meta, raw_score in zip(docs_raw, metas_raw, scores):
        if raw_score <= 0:
            continue
        norm_score = float(raw_score / max_score)
        doc_obj = Document(page_content=doc_text, metadata=meta)
        doc_score_pairs.append((doc_obj, norm_score))

    doc_score_pairs.sort(key=lambda x: (x[1], x[0].metadata.get("chunkId", "")), reverse=True)
    return doc_score_pairs[:top_k]


def _hybrid_retrieve(
    question: str,
    top_k: int,
    organization_id: str,
    document_type: Optional[str] = None,
    filter_document: Optional[str] = None,
    mode: str = "hybrid"
) -> List[tuple]:
    if not organization_id or not str(organization_id).strip():
        raise ValueError("Tenant context (organizationId) is required for RAG operations.")

    if mode == "dense":
        return _retrieve(question, top_k, organization_id, document_type, filter_document)

    if mode == "sparse":
        return _sparse_bm25_retrieve(question, top_k, organization_id, document_type, filter_document)

    # Hybrid RRF fusion mode
    fetch_k = max(top_k * 2, 10)
    dense_results = _retrieve(question, fetch_k, organization_id, document_type, filter_document)
    sparse_results = _sparse_bm25_retrieve(question, fetch_k, organization_id, document_type, filter_document)

    rrf_map = {}
    for rank, (doc, score) in enumerate(dense_results):
        cid = doc.metadata.get("chunkId") or hash(doc.page_content)
        if cid not in rrf_map:
            rrf_map[cid] = {"doc": doc, "rrf_score": 0.0, "dense_score": score, "sparse_score": 0.0}
        rrf_map[cid]["rrf_score"] += 1.0 / (60.0 + rank + 1)

    for rank, (doc, score) in enumerate(sparse_results):
        cid = doc.metadata.get("chunkId") or hash(doc.page_content)
        if cid not in rrf_map:
            rrf_map[cid] = {"doc": doc, "rrf_score": 0.0, "dense_score": 0.0, "sparse_score": score}
        else:
            rrf_map[cid]["sparse_score"] = score
        rrf_map[cid]["rrf_score"] += 1.0 / (60.0 + rank + 1)

    if not rrf_map:
        return []

    max_rrf = max(v["rrf_score"] for v in rrf_map.values()) or 1.0

    merged = []
    for cid, entry in rrf_map.items():
        doc = entry["doc"]
        norm_rrf = round(entry["rrf_score"] / max_rrf, 4)
        effective_score = max(norm_rrf, entry["dense_score"])
        merged.append((doc, effective_score))

    merged.sort(key=lambda x: (x[1], x[0].metadata.get("chunkId", "")), reverse=True)
    return merged[:top_k]


def _to_source_document(doc, score: float) -> Dict[str, Any]:
    display_score = max(0.0, min(1.0, float(score)))
    return {
        "documentName": doc.metadata.get("documentName", doc.metadata.get("source", "Unknown")),
        "documentId": doc.metadata.get("documentId"),
        "organizationId": doc.metadata.get("organizationId"),
        "pageNumber": doc.metadata.get("pageNumber", doc.metadata.get("page")),
        "chunkId": doc.metadata.get("chunkId"),
        "content": doc.page_content[:300],
        "similarityScore": round(display_score, 4),
    }


def _evaluate_groundedness(answer: str, sources: List[Dict], scored_docs: List[tuple]) -> tuple[float, int, bool]:
    """
    Evaluates answer groundedness against retrieved context.
    Returns (groundedness_score [0.0-1.0], citation_count, is_grounded).
    """
    if not answer or _NOT_AVAILABLE_ANSWER.lower() in answer.lower() or not sources:
        return 0.0, 0, False

    citations = re.findall(r"\[Doc:\s*[^\]]+\]", answer)
    citation_count = len(citations)

    context_text = " ".join([doc.page_content for doc, _ in scored_docs]).lower()
    context_words = set(re.findall(r"\w+", context_text))

    raw_sentences = [s.strip() for s in re.split(r"[.!?]\s+", answer) if s.strip()]
    if not raw_sentences:
        return (1.0 if citation_count > 0 else 0.8), citation_count, True

    supported_count = 0
    for sentence in raw_sentences:
        clean_sentence = re.sub(r"\[Doc:\s*[^\]]+\]", "", sentence).strip()
        sent_words = set(re.findall(r"\w+", clean_sentence.lower()))
        if len(sent_words) <= 2:
            supported_count += 1
            continue

        overlap = sent_words.intersection(context_words)
        overlap_ratio = len(overlap) / float(len(sent_words)) if sent_words else 0
        if overlap_ratio >= 0.4:
            supported_count += 1

    groundedness_score = round(min(1.0, max(0.0, supported_count / float(len(raw_sentences)))), 2)
    is_grounded = groundedness_score >= 0.5 or citation_count > 0

    return groundedness_score, citation_count, is_grounded


# ---------------------------------------------------------------------------
# RAG query (grounded generation)
# ---------------------------------------------------------------------------

async def query_rag(
    question: str,
    organization_id: str,
    user_id: str = "anonymous",
    filter_document: str = None,
    document_type: str = None,
    top_k: int = 4,
    retrieval_mode: str = "hybrid",
) -> Dict[str, Any]:
    """
    Runs the full RAG pipeline: retrieve relevant chunks (hybrid dense+BM25 with RRF),
    generate a grounded answer with inline citations, evaluate groundedness.
    Enforces tenant isolation and fail-closed defense-in-depth checks.
    """
    start_total = time.time()
    top_k = max(1, min(top_k, 20))

    if not organization_id or not str(organization_id).strip():
        # FAIL CLOSED guard — missing organizationId returns zero chunks immediately
        latency_ms = round((time.time() - start_total) * 1000, 2)
        return {
            "answer": _NOT_AVAILABLE_ANSWER,
            "sourceDocuments": [],
            "confidenceScore": 0.0,
            "latencyMs": latency_ms,
            "retrievedChunksCount": 0,
            "groundednessScore": 0.0,
            "retrievalLatencyMs": latency_ms,
            "generationLatencyMs": 0.0,
            "totalLatencyMs": latency_ms,
            "candidateCount": 0,
            "citationCount": 0,
            "cacheHit": False,
            "retrievalMode": retrieval_mode,
        }

    start_retrieval = time.time()
    scored = _hybrid_retrieve(question, top_k, organization_id, document_type, filter_document, mode=retrieval_mode)
    candidate_count = len(scored)

    # DEFENSE-IN-DEPTH TENANT VALIDATION (User Constraint 5):
    # Verify every retrieved document matches the requested organizationId
    validated_scored = []
    for doc, score in scored:
        doc_org = doc.metadata.get("organizationId")
        if doc_org != organization_id:
            raise ValueError(f"Tenant integrity error: retrieved document organizationId '{doc_org}' does not match requested organizationId '{organization_id}'.")
        if score >= MIN_RELEVANCE_SCORE:
            validated_scored.append((doc, score))

    scored = validated_scored
    retrieval_latency_ms = round((time.time() - start_retrieval) * 1000, 2)

    if not scored:
        # Hard grounding guard — the LLM is never called with no evidence.
        total_latency_ms = round((time.time() - start_total) * 1000, 2)
        await log_rag_query(
            question, _NOT_AVAILABLE_ANSWER, [], user_id, total_latency_ms,
            grounded=False, organization_id=organization_id, groundedness_score=0.0,
            retrieval_latency_ms=retrieval_latency_ms, generation_latency_ms=0.0,
            citation_count=0, retrieval_mode=retrieval_mode
        )
        return {
            "answer": _NOT_AVAILABLE_ANSWER,
            "sourceDocuments": [],
            "confidenceScore": 0.0,
            "latencyMs": total_latency_ms,
            "retrievedChunksCount": 0,
            "groundednessScore": 0.0,
            "retrievalLatencyMs": retrieval_latency_ms,
            "generationLatencyMs": 0.0,
            "totalLatencyMs": total_latency_ms,
            "candidateCount": candidate_count,
            "citationCount": 0,
            "cacheHit": False,
            "retrievalMode": retrieval_mode,
        }

    sources = [_to_source_document(doc, score) for doc, score in scored]
    context_text = "\n\n".join(
        wrap_as_untrusted_document(
            source["documentName"],
            doc.page_content,
            page_number=source.get("pageNumber"),
            chunk_id=source.get("chunkId"),
        )
        for (doc, _), source in zip(scored, sources)
    )

    llm = get_llm()
    formatted_prompt = prompt_template.format(context=context_text, question=question)

    start_gen = time.time()
    loop = asyncio.get_event_loop()
    try:
        response = await asyncio.wait_for(
            loop.run_in_executor(None, llm.invoke, formatted_prompt),
            timeout=RAG_LLM_TIMEOUT_SECONDS,
        )
    except asyncio.TimeoutError:
        raise TimeoutError("The knowledge assistant timed out generating an answer. Please try again.")

    generation_latency_ms = round((time.time() - start_gen) * 1000, 2)
    answer = response.content if hasattr(response, "content") else str(response)
    total_latency_ms = round((time.time() - start_total) * 1000, 2)

    groundedness_score, citation_count, is_grounded = _evaluate_groundedness(answer, sources, scored)
    avg_score = sum(s["similarityScore"] for s in sources) / len(sources)
    confidence_score = round(avg_score, 2) if is_grounded else 0.1

    await log_rag_query(
        question, answer, sources, user_id, total_latency_ms,
        grounded=is_grounded, organization_id=organization_id, groundedness_score=groundedness_score,
        retrieval_latency_ms=retrieval_latency_ms, generation_latency_ms=generation_latency_ms,
        citation_count=citation_count, retrieval_mode=retrieval_mode
    )

    return {
        "answer": answer,
        "sourceDocuments": sources,
        "confidenceScore": confidence_score,
        "latencyMs": total_latency_ms,
        "retrievedChunksCount": len(sources),
        "groundednessScore": groundedness_score,
        "retrievalLatencyMs": retrieval_latency_ms,
        "generationLatencyMs": generation_latency_ms,
        "totalLatencyMs": total_latency_ms,
        "candidateCount": candidate_count,
        "citationCount": citation_count,
        "cacheHit": False,
        "retrievalMode": retrieval_mode,
    }


# ---------------------------------------------------------------------------
# Search — semantic and keyword, no LLM generation (cheap, fast)
# ---------------------------------------------------------------------------

def search_knowledge(
    query_text: str,
    organization_id: str,
    mode: str = "semantic",
    top_k: int = 10,
    document_type: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Enterprise search over indexed chunks filtered strictly by organizationId.
    """
    if not organization_id or not str(organization_id).strip():
        return {"mode": mode, "results": [], "resultCount": 0}

    top_k = max(1, min(top_k, 50))
    vectorstore = get_vectorstore()
    filter_dict = _build_filter(organization_id, document_type, None)

    if mode == "keyword":
        data = vectorstore.get(include=["metadatas", "documents"], where=filter_dict)
        needle = query_text.lower()
        results = []
        for doc_text, meta in zip(data.get("documents", []), data.get("metadatas", [])):
            if needle in (doc_text or "").lower():
                results.append({
                    "documentName": meta.get("documentName", meta.get("source", "Unknown")),
                    "documentId": meta.get("documentId"),
                    "organizationId": meta.get("organizationId"),
                    "pageNumber": meta.get("pageNumber", meta.get("page")),
                    "chunkId": meta.get("chunkId"),
                    "content": (doc_text or "")[:300],
                    "similarityScore": None,
                })
        results = results[:top_k]
    else:
        scored = vectorstore.similarity_search_with_relevance_scores(query_text, k=top_k, filter=filter_dict)
        results = [_to_source_document(doc, score) for doc, score in scored]

    return {"mode": mode, "results": results, "resultCount": len(results)}


# ---------------------------------------------------------------------------
# Document detail — chunk-level view of one document (admin drill-down)
# ---------------------------------------------------------------------------

def get_document_chunks(document_id: str, organization_id: Optional[str] = None) -> Dict[str, Any]:
    if not organization_id or not str(organization_id).strip():
        return {
            "documentId": document_id,
            "chunkCount": 0,
            "chunks": [],
        }

    vectorstore = get_vectorstore()
    where_clause = {"$and": [{"documentId": document_id}, {"organizationId": organization_id}]}
    data = vectorstore.get(where=where_clause, include=["metadatas", "documents"])
    chunks = []
    for doc_text, meta in zip(data.get("documents", []), data.get("metadatas", [])):
        chunks.append({
            "chunkId": meta.get("chunkId"),
            "pageNumber": meta.get("pageNumber", meta.get("page")),
            "preview": (doc_text or "")[:300],
        })
    return {
        "documentId": document_id,
        "chunkCount": len(chunks),
        "chunks": chunks,
    }


# ---------------------------------------------------------------------------
# Health / statistics
# ---------------------------------------------------------------------------

def get_vectorstore_health() -> Dict[str, Any]:
    """Returns vectorstore connection and chunk count."""
    try:
        vs = get_vectorstore()
        count = vs._collection.count()
        return {"status": "healthy", "indexedChunkCount": count, "vectorstoreConnected": True}
    except Exception as e:
        return {"status": f"unhealthy: {e}", "indexedChunkCount": 0, "vectorstoreConnected": False}


async def get_rag_statistics() -> Dict[str, Any]:
    """Aggregates statistics from the rag_logs MongoDB collection and ChromaDB."""
    health = get_vectorstore_health()

    try:
        db = get_db()
        total_queries = await db["rag_logs"].count_documents({})
        grounded_queries = await db["rag_logs"].count_documents({"grounded": True})
        success_rate = round(grounded_queries / total_queries, 2) if total_queries else 0.0

        pipeline = [
            {"$unwind": "$retrievedDocuments"},
            {"$group": {"_id": "$retrievedDocuments", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": 5},
        ]
        top_docs = await db["rag_logs"].aggregate(pipeline).to_list(5)
        most_searched = [d["_id"] for d in top_docs if d["_id"]]

        vs = get_vectorstore()
        all_meta = vs.get(include=["metadatas"])
        sources = set(m.get("source", "unknown") for m in all_meta.get("metadatas", []))

        return {
            "indexedDocuments": len(sources),
            "totalChunks": health["indexedChunkCount"],
            "recentQueryCount": total_queries,
            "mostSearchedPolicies": most_searched,
            "querySuccessRate": success_rate,
        }
    except Exception as e:
        print(f"Failed to compute RAG statistics: {e}")
        return {
            "indexedDocuments": 0,
            "totalChunks": health["indexedChunkCount"],
            "recentQueryCount": 0,
            "mostSearchedPolicies": [],
            "querySuccessRate": 0.0,
        }
