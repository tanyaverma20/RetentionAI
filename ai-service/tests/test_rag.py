"""
tests/test_rag.py
=================
RAG Module Tests - covers:
 - Document loading
 - Text chunking
 - Vectorstore indexing and retrieval
 - API endpoint contracts (with mocked LLM)
"""

import pytest
from unittest.mock import patch, MagicMock
from langchain_core.documents import Document
from fastapi.testclient import TestClient

# ─── Unit Tests: Chunker ──────────────────────────────────────────────────────

def test_text_chunker_splits_correctly():
    from app.rag.chunkers.text_chunker import split_documents
    
    # Create a large fake document to force splitting
    content = "This is a sentence about company leave policy. " * 100
    fake_doc = Document(page_content=content, metadata={"source": "Leave Policy.pdf", "documentName": "Leave Policy.pdf"})
    
    chunks = split_documents([fake_doc])
    
    assert len(chunks) > 1, "Long document should be split into multiple chunks"
    for chunk in chunks:
        assert "chunkId" in chunk.metadata, "Each chunk should have a chunkId"
        assert len(chunk.page_content) > 0

def test_chunker_preserves_metadata():
    from app.rag.chunkers.text_chunker import split_documents
    
    fake_doc = Document(
        page_content="Employee vacation policy is 20 days per year.",
        metadata={"source": "Employee Handbook.pdf", "page": 5, "documentName": "Employee Handbook.pdf"}
    )
    chunks = split_documents([fake_doc])
    
    assert chunks[0].metadata["documentName"] == "Employee Handbook.pdf"
    assert chunks[0].metadata["pageNumber"] == 5


# ─── Unit Tests: Document Loader ─────────────────────────────────────────────

def test_loader_returns_empty_for_missing_dir():
    from app.rag.loaders.document_loader import load_documents
    docs = load_documents("/nonexistent/path")
    assert docs == []


# ─── Unit Tests: Embeddings ───────────────────────────────────────────────────

def test_embeddings_are_cached():
    from app.rag.embeddings.embedding_manager import get_embeddings
    emb1 = get_embeddings()
    emb2 = get_embeddings()
    assert emb1 is emb2, "Embeddings should be cached and return the same instance"


# ─── Unit Tests: RAG Service ──────────────────────────────────────────────────

def test_index_with_no_documents_fails_gracefully():
    from app.rag.services.rag_service import index_knowledge_base
    result = index_knowledge_base("/nonexistent/dir")
    assert result["success"] is False
    assert result["documentsIndexed"] == 0


# ─── API Tests ────────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def client():
    from app.main import app
    from app.api.rag_routes import verify_auth_token
    app.dependency_overrides[verify_auth_token] = lambda: True
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_rag_health_endpoint(client):
    with patch("app.api.rag_routes.get_vectorstore_health") as mock_health:
        mock_health.return_value = {
            "status": "healthy",
            "indexedChunkCount": 120,
            "vectorstoreConnected": True
        }
        response = client.get("/rag/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["vectorstoreConnected"] is True


@pytest.mark.asyncio
async def test_rag_query_endpoint(client):
    """
    Tests the query endpoint with a mocked RAG chain to avoid calling the real LLM.
    """
    with patch("app.rag.services.rag_service.query_rag") as mock_query:
        mock_query.return_value = {
            "answer": "Employees are entitled to 20 days of annual leave.",
            "sourceDocuments": [
                {"documentName": "Leave Policy.pdf", "pageNumber": 3, "chunkId": "abc-123", "content": "20 days..."}
            ],
            "confidenceScore": 0.85,
            "latencyMs": 350.5,
            "retrievedChunksCount": 4
        }
        
        response = client.post("/rag/query", json={
            "question": "How many annual leave days do I get?",
            "userId": "test_user",
            "organizationId": "60d5ec388832a828f8000000"
        })
        
        assert response.status_code == 200
        data = response.json()
        assert "answer" in data
        assert len(data["sourceDocuments"]) > 0
        assert data["confidenceScore"] > 0


def test_rag_query_empty_question(client):
    response = client.post("/rag/query", json={"question": "", "organizationId": "60d5ec388832a828f8000000"})
    assert response.status_code == 422


def test_rag_index_endpoint(client):
    with patch("app.api.rag_routes.index_knowledge_base") as mock_index:
        mock_index.return_value = {
            "success": True,
            "message": "Successfully indexed 5 documents into 42 chunks.",
            "documentsIndexed": 5,
            "chunksIndexed": 42
        }
        response = client.post("/rag/index", json={"organizationId": "60d5ec388832a828f8000000"})
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["documentsIndexed"] == 5
