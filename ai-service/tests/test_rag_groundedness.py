"""
tests/test_rag_groundedness.py
===============================
Unit and contract tests for Advanced Grounded RAG & Hybrid Retrieval.
Covers:
 - Claim groundedness scoring & citation evaluation
 - Sparse BM25 and Hybrid RRF retrieval
 - Tenant organizationId filtering in hybrid retrieval
 - API contract metrics (groundednessScore, latencies, citationCount)
"""

import pytest
from unittest.mock import patch, MagicMock
from langchain_core.documents import Document
from fastapi.testclient import TestClient

from app.rag.services.rag_service import (
    _evaluate_groundedness,
    _hybrid_retrieve,
    _sparse_bm25_retrieve,
    query_rag,
)


def test_evaluate_groundedness_with_citations_and_supported_claims():
    doc1 = Document(
        page_content="Employees receive 20 days of paid annual leave per year after completion of probation.",
        metadata={"documentName": "Leave Policy.pdf", "pageNumber": 2, "chunkId": "chunk-1"}
    )
    sources = [{
        "documentName": "Leave Policy.pdf",
        "pageNumber": 2,
        "chunkId": "chunk-1",
        "content": doc1.page_content,
        "similarityScore": 0.92,
    }]
    scored_docs = [(doc1, 0.92)]

    answer = "Employees get 20 days of paid annual leave per year. [Doc: Leave Policy.pdf, Page 2]"

    score, citation_count, is_grounded = _evaluate_groundedness(answer, sources, scored_docs)

    assert score > 0.5
    assert citation_count == 1
    assert is_grounded is True


def test_evaluate_groundedness_unsupported_claim():
    doc1 = Document(
        page_content="Employees receive 20 days of paid annual leave per year.",
        metadata={"documentName": "Leave Policy.pdf", "pageNumber": 2, "chunkId": "chunk-1"}
    )
    sources = [{
        "documentName": "Leave Policy.pdf",
        "pageNumber": 2,
        "chunkId": "chunk-1",
        "content": doc1.page_content,
        "similarityScore": 0.92,
    }]
    scored_docs = [(doc1, 0.92)]

    answer = "The company provides unlimited free helicopter rides for all remote staff in Hawaii."

    score, citation_count, is_grounded = _evaluate_groundedness(answer, sources, scored_docs)

    assert score < 0.5
    assert citation_count == 0


def test_hybrid_retrieve_filters_by_tenant_org():
    target_org = "org-test-111"
    wrong_org = "org-test-999"

    doc_target = Document(
        page_content="Remote work is permitted up to 2 days per week for software engineers.",
        metadata={"organizationId": target_org, "chunkId": "c1", "source": "RemoteWork.pdf"}
    )
    doc_wrong = Document(
        page_content="Remote work is permitted up to 5 days per week.",
        metadata={"organizationId": wrong_org, "chunkId": "c2", "source": "OtherOrg.pdf"}
    )

    mock_vectorstore = MagicMock()
    mock_vectorstore.similarity_search_with_relevance_scores.return_value = [(doc_target, 0.88)]
    mock_vectorstore.get.return_value = {
        "documents": [doc_target.page_content],
        "metadatas": [doc_target.metadata]
    }

    with patch("app.rag.services.rag_service.get_vectorstore", return_value=mock_vectorstore):
        results = _hybrid_retrieve(
            question="What is the remote work policy?",
            top_k=5,
            organization_id=target_org,
            mode="hybrid"
        )
        assert len(results) >= 1
        for doc, score in results:
            assert doc.metadata["organizationId"] == target_org


@pytest.fixture
def client():
    from app.main import app
    from app.api.rag_routes import verify_auth_token
    app.dependency_overrides[verify_auth_token] = lambda: True
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_knowledge_query_api_contract_metrics(client):
    headers = {"Authorization": "Bearer replace-with-a-service-token"}
    mock_result = {
        "answer": "Employees receive 20 annual leave days. [Doc: Leave Policy.pdf, Page 1]",
        "sourceDocuments": [{
            "documentName": "Leave Policy.pdf",
            "documentId": "doc-123",
            "organizationId": "60d5ec388832a828f8000000",
            "pageNumber": 1,
            "chunkId": "chunk-10",
            "content": "Employees receive 20 annual leave days.",
            "similarityScore": 0.89,
        }],
        "confidenceScore": 0.89,
        "latencyMs": 145.2,
        "retrievedChunksCount": 1,
        "groundednessScore": 0.95,
        "retrievalLatencyMs": 42.1,
        "generationLatencyMs": 103.1,
        "totalLatencyMs": 145.2,
        "candidateCount": 2,
        "citationCount": 1,
        "cacheHit": False,
        "retrievalMode": "hybrid",
    }

    with patch("app.api.rag_routes.query_rag", return_value=mock_result):
        res = client.post(
            "/knowledge/query",
            headers=headers,
            json={
                "question": "How many leave days?",
                "organizationId": "60d5ec388832a828f8000000",
                "retrievalMode": "hybrid"
            }
        )

        assert res.status_code == 200
        data = res.json()
        assert data["groundednessScore"] == 0.95
        assert data["citationCount"] == 1
        assert data["retrievalMode"] == "hybrid"
        assert data["retrievalLatencyMs"] == 42.1
        assert data["generationLatencyMs"] == 103.1
