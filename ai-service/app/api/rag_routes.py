"""
app/api/rag_routes.py
=====================
FastAPI router for the Knowledge Intelligence (RAG) module.

New (Knowledge Intelligence sprint) endpoints:
- POST /documents/upload         : (Re)index one uploaded file with metadata
- POST /documents/reindex        : Re-index one previously-uploaded file
- POST /knowledge/query          : Grounded question-answering with citations
- GET  /knowledge/search         : Semantic/keyword search, no LLM generation
- GET  /knowledge/document/{id}  : Chunk-level detail for one document
- GET  /knowledge/statistics     : Dashboard statistics

Legacy endpoints (kept for backward compatibility, now fixed):
- POST /rag/query, /rag/index, /rag/reindex, GET /rag/documents, /rag/health, /rag/statistics

Security
--------
Every route here now requires the same Bearer auth as the prediction/explain
routes (previously this router had NONE). `/rag/index`/`/rag/reindex` no
longer accept a caller-supplied directory — the earlier implementation let
any request read arbitrary server filesystem paths via `directory` in the
request body; that field is now ignored for anything other than the
server's own fixed knowledge_base folder.
"""

import os
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status

from app.rag.schemas import (
    DocumentDetailResponse,
    DocumentIndexRequest,
    RAGQueryRequest,
    RAGQueryResponse,
    RAGIndexResponse,
    RAGHealthResponse,
    RAGStatisticsResponse,
    SearchResponse,
    SourceDocument,
)
from app.rag.services.rag_service import (
    query_rag,
    search_knowledge,
    get_document_chunks,
    index_knowledge_base,
    index_single_document,
    reindex_knowledge_base,
    delete_document,
    get_vectorstore_health,
    get_rag_statistics,
)
from app.rag.vectorstore.chroma_store import get_vectorstore

router = APIRouter(tags=["Knowledge Intelligence"])


# ---------------------------------------------------------------------------
# Auth (mirrors verify_auth_token in routes.py / explain_routes.py)
# ---------------------------------------------------------------------------

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


def _to_error_detail(exc: Exception) -> str:
    return str(exc)


# ---------------------------------------------------------------------------
# POST /documents/upload — index one newly-uploaded file
# ---------------------------------------------------------------------------

@router.post("/documents/upload", response_model=RAGIndexResponse, dependencies=[Depends(verify_auth_token)])
async def documents_upload(request: DocumentIndexRequest):
    try:
        metadata = {
            "documentType": request.documentType,
            "tags": request.tags or [],
            "uploadedBy": request.uploadedBy,
            "uploadDate": request.uploadDate,
            "version": request.version,
        }
        result = index_single_document(request.filePath, request.documentId, metadata)
        return RAGIndexResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=_to_error_detail(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Document indexing failed: {e}")


# ---------------------------------------------------------------------------
# POST /documents/reindex — re-index one previously-uploaded file
# ---------------------------------------------------------------------------

@router.post("/documents/reindex", response_model=RAGIndexResponse, dependencies=[Depends(verify_auth_token)])
async def documents_reindex(request: DocumentIndexRequest):
    try:
        metadata = {
            "documentType": request.documentType,
            "tags": request.tags or [],
            "uploadedBy": request.uploadedBy,
            "uploadDate": request.uploadDate,
            "version": request.version,
        }
        result = index_single_document(request.filePath, request.documentId, metadata)
        return RAGIndexResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=_to_error_detail(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Document re-indexing failed: {e}")


# ---------------------------------------------------------------------------
# DELETE /documents/{documentId} — remove one document's chunks
# ---------------------------------------------------------------------------

@router.delete("/documents/{documentId}", dependencies=[Depends(verify_auth_token)])
async def documents_delete(documentId: str):
    try:
        result = delete_document(documentId)
        return {"success": True, "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete document: {e}")


# ---------------------------------------------------------------------------
# POST /knowledge/query — grounded Q&A with citations
# ---------------------------------------------------------------------------

@router.post("/knowledge/query", response_model=RAGQueryResponse, dependencies=[Depends(verify_auth_token)])
async def knowledge_query(request: RAGQueryRequest):
    if not request.question.strip():
        raise HTTPException(status_code=422, detail="Question cannot be empty.")

    try:
        result = await query_rag(
            question=request.question,
            user_id=request.userId or "anonymous",
            filter_document=request.filterDocument,
            document_type=request.documentType,
            top_k=request.topK or 4,
        )
        return RAGQueryResponse(
            answer=result["answer"],
            sourceDocuments=[SourceDocument(**s) for s in result["sourceDocuments"]],
            confidenceScore=result["confidenceScore"],
            latencyMs=result["latencyMs"],
            retrievedChunksCount=result["retrievedChunksCount"],
        )
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except TimeoutError as e:
        raise HTTPException(status_code=504, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Knowledge query failed: {e}")


# ---------------------------------------------------------------------------
# GET /knowledge/search — semantic/keyword search, no LLM generation
# ---------------------------------------------------------------------------

@router.get("/knowledge/search", response_model=SearchResponse, dependencies=[Depends(verify_auth_token)])
async def knowledge_search(
    q: str = Query(..., min_length=1),
    mode: str = Query("semantic", pattern="^(semantic|keyword)$"),
    topK: int = Query(10, ge=1, le=50),
    documentType: Optional[str] = Query(None),
):
    try:
        result = search_knowledge(q, mode=mode, top_k=topK, document_type=documentType)
        return SearchResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search failed: {e}")


# ---------------------------------------------------------------------------
# GET /knowledge/document/{documentId} — chunk-level detail
# ---------------------------------------------------------------------------

@router.get("/knowledge/document/{documentId}", response_model=DocumentDetailResponse, dependencies=[Depends(verify_auth_token)])
async def knowledge_document_detail(documentId: str):
    try:
        result = get_document_chunks(documentId)
        if result["chunkCount"] == 0:
            raise HTTPException(status_code=404, detail=f"No indexed chunks found for document {documentId}")
        return DocumentDetailResponse(**result)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch document detail: {e}")


# ---------------------------------------------------------------------------
# GET /knowledge/statistics
# ---------------------------------------------------------------------------

@router.get("/knowledge/statistics", response_model=RAGStatisticsResponse, dependencies=[Depends(verify_auth_token)])
async def knowledge_statistics():
    stats = await get_rag_statistics()
    return RAGStatisticsResponse(**stats)


# ---------------------------------------------------------------------------
# Legacy /rag/* endpoints — kept for backward compatibility, now authenticated
# and fixed (no more caller-supplied directory, delegate to the same service
# functions as the /knowledge/* routes above).
# ---------------------------------------------------------------------------

@router.post("/rag/query", response_model=RAGQueryResponse, dependencies=[Depends(verify_auth_token)])
async def rag_query(request: RAGQueryRequest):
    return await knowledge_query(request)


@router.post("/rag/index", response_model=RAGIndexResponse, dependencies=[Depends(verify_auth_token)])
def rag_index():
    """Bulk-indexes the server's fixed knowledge_base/ directory only."""
    try:
        result = index_knowledge_base()
        return RAGIndexResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Indexing failed: {e}")


@router.post("/rag/reindex", response_model=RAGIndexResponse, dependencies=[Depends(verify_auth_token)])
def rag_reindex():
    """Clears and re-indexes the server's fixed knowledge_base/ directory only."""
    try:
        result = reindex_knowledge_base()
        return RAGIndexResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Re-indexing failed: {e}")


@router.get("/rag/documents", response_model=List[Dict[str, Any]], dependencies=[Depends(verify_auth_token)])
def list_indexed_documents():
    """Returns a list of all indexed document names from the vector store."""
    try:
        vs = get_vectorstore()
        data = vs.get(include=["metadatas"])
        metadatas = data.get("metadatas", [])

        seen = set()
        documents = []
        for m in metadatas:
            name = m.get("source", m.get("documentName", "Unknown"))
            if name not in seen:
                seen.add(name)
                documents.append({
                    "documentName": name,
                    "documentId": m.get("documentId"),
                    "documentType": m.get("documentType"),
                    "pageCount": m.get("pageNumber"),
                })

        return documents
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list documents: {e}")


@router.get("/rag/health", response_model=RAGHealthResponse, dependencies=[Depends(verify_auth_token)])
def rag_health():
    """Returns the current health status of the RAG system, including vectorstore connectivity."""
    health = get_vectorstore_health()
    return RAGHealthResponse(**health)


@router.get("/rag/statistics", response_model=RAGStatisticsResponse, dependencies=[Depends(verify_auth_token)])
async def rag_statistics():
    return await knowledge_statistics()
