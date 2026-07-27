"""
app/api/rag_routes.py
=====================
FastAPI router for the RAG (Retrieval-Augmented Generation) module.

Endpoints:
- POST /rag/query        : Query the knowledge base with a natural language question
- POST /rag/index        : Index documents from the knowledge base directory
- POST /rag/reindex      : Clear and re-index all documents
- GET  /rag/documents    : List all indexed documents
- GET  /rag/health       : Check vectorstore health
- GET  /rag/statistics   : Dashboard statistics for indexed docs and queries
"""

from fastapi import APIRouter, BackgroundTasks, HTTPException
from typing import List, Dict, Any

from app.rag.schemas import (
    RAGQueryRequest,
    RAGQueryResponse,
    RAGIndexRequest,
    RAGIndexResponse,
    RAGHealthResponse,
    RAGStatisticsResponse,
    SourceDocument,
)
from app.rag.services.rag_service import (
    query_rag,
    index_knowledge_base,
    reindex_knowledge_base,
    get_vectorstore_health,
    get_rag_statistics,
)
from app.rag.vectorstore.chroma_store import get_vectorstore

router = APIRouter(prefix="/rag", tags=["RAG"])


@router.post("/query", response_model=RAGQueryResponse)
async def rag_query(request: RAGQueryRequest):
    """
    Query the HR knowledge base.
    The LLM generates a response grounded exclusively in indexed policy documents.
    """
    if not request.question.strip():
        raise HTTPException(status_code=422, detail="Question cannot be empty.")

    try:
        result = await query_rag(
            question=request.question,
            user_id=request.userId or "anonymous",
            filter_document=request.filterDocument,
        )
        return RAGQueryResponse(
            answer=result["answer"],
            sourceDocuments=[SourceDocument(**s) for s in result["sourceDocuments"]],
            confidenceScore=result["confidenceScore"],
            latencyMs=result["latencyMs"],
            retrievedChunksCount=result["retrievedChunksCount"],
        )
    except ValueError as e:
        # GROQ_API_KEY missing etc
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"RAG query failed: {e}")


@router.post("/index", response_model=RAGIndexResponse)
def rag_index(request: RAGIndexRequest = None, background_tasks: BackgroundTasks = None):
    """
    Trigger incremental document indexing.
    If directory is not supplied, uses the default knowledge_base/ folder.
    """
    try:
        directory = request.directory if request else None
        result = index_knowledge_base(directory)
        return RAGIndexResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Indexing failed: {e}")


@router.post("/reindex", response_model=RAGIndexResponse)
def rag_reindex(request: RAGIndexRequest = None):
    """
    Clears the existing vector store and re-indexes from scratch.
    Use this when documents have been updated or removed.
    """
    try:
        directory = request.directory if request else None
        result = reindex_knowledge_base(directory)
        return RAGIndexResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Re-indexing failed: {e}")


@router.get("/documents", response_model=List[Dict[str, Any]])
def list_indexed_documents():
    """
    Returns a list of all indexed document names from the vector store.
    """
    try:
        vs = get_vectorstore()
        data = vs.get(include=["metadatas"])
        metadatas = data.get("metadatas", [])

        # Deduplicate by document name
        seen = set()
        documents = []
        for m in metadatas:
            name = m.get("source", m.get("documentName", "Unknown"))
            if name not in seen:
                seen.add(name)
                documents.append({
                    "documentName": name,
                    "pageCount": m.get("pageNumber")
                })

        return documents
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list documents: {e}")


@router.get("/health", response_model=RAGHealthResponse)
def rag_health():
    """
    Returns the current health status of the RAG system, including vectorstore connectivity.
    """
    health = get_vectorstore_health()
    return RAGHealthResponse(**health)


@router.get("/statistics", response_model=RAGStatisticsResponse)
async def rag_statistics():
    """
    Returns dashboard statistics: indexed document count, query count, and most queried policies.
    """
    stats = await get_rag_statistics()
    return RAGStatisticsResponse(**stats)
