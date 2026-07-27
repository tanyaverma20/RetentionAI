"""
app/rag/services/rag_service.py
================================
Business logic layer for the RAG module.
- Orchestrates document loading, chunking, indexing, and querying.
- Logs all RAG queries to MongoDB for audit and analytics.
"""

import os
import time
from typing import Dict, Any, List

from app.rag.loaders.document_loader import load_documents
from app.rag.chunkers.text_chunker import split_documents
from app.rag.vectorstore.chroma_store import get_vectorstore, index_documents, clear_vectorstore
from app.rag.chains.rag_chain import get_rag_chain
from app.utils.database import get_db

KNOWLEDGE_BASE_DIR = os.path.join(
    os.path.dirname(__file__), "../../../knowledge_base"
)


async def log_rag_query(query: str, response: str, sources: List[Dict], user_id: str, latency_ms: float):
    """Logs RAG query metadata to MongoDB for analytics."""
    try:
        db = await get_db()
        await db["rag_logs"].insert_one({
            "query": query,
            "response": response,
            "retrievedDocuments": [s.get("documentName") for s in sources],
            "latencyMs": latency_ms,
            "userId": user_id,
            "timestamp": __import__("datetime").datetime.utcnow()
        })
    except Exception as e:
        print(f"Failed to log RAG query: {e}")


def index_knowledge_base(directory: str = None) -> Dict[str, Any]:
    """
    Loads, chunks, and indexes all documents from the knowledge_base directory.
    """
    kb_dir = directory or KNOWLEDGE_BASE_DIR
    documents = load_documents(kb_dir)

    if not documents:
        return {"success": False, "message": "No documents found.", "documentsIndexed": 0, "chunksIndexed": 0}

    chunks = split_documents(documents)

    # Index into ChromaDB
    index_documents(chunks)

    # Count unique source documents
    unique_docs = len(set(c.metadata.get("source", "unknown") for c in chunks))

    return {
        "success": True,
        "message": f"Successfully indexed {unique_docs} documents into {len(chunks)} chunks.",
        "documentsIndexed": unique_docs,
        "chunksIndexed": len(chunks)
    }


def reindex_knowledge_base(directory: str = None) -> Dict[str, Any]:
    """
    Clears the existing vector store and re-indexes from scratch.
    """
    try:
        clear_vectorstore()
    except Exception as e:
        print(f"Warning during clear: {e}")

    return index_knowledge_base(directory)


async def query_rag(question: str, user_id: str = "anonymous", filter_document: str = None) -> Dict[str, Any]:
    """
    Runs the full RAG pipeline: retrieve relevant chunks, generate grounded answer.
    Returns answer, source metadata, confidence score, and latency.
    """
    start = time.time()

    rag_chain = get_rag_chain()
    result = rag_chain.invoke({"input": question})

    latency_ms = round((time.time() - start) * 1000, 2)

    answer = result.get("answer", "")
    context_docs = result.get("context", [])

    # Build source documents list
    sources = []
    for doc in context_docs:
        sources.append({
            "documentName": doc.metadata.get("documentName", doc.metadata.get("source", "Unknown")),
            "pageNumber": doc.metadata.get("pageNumber", doc.metadata.get("page")),
            "chunkId": doc.metadata.get("chunkId"),
            "content": doc.page_content[:300]  # Return a preview
        })

    # Simple confidence heuristic: if the answer says "not available", confidence is 0
    is_grounded = "not available in the company" not in answer.lower()
    confidence_score = round(0.85 if is_grounded and sources else 0.1, 2)

    # Log to MongoDB in background
    await log_rag_query(question, answer, sources, user_id, latency_ms)

    return {
        "answer": answer,
        "sourceDocuments": sources,
        "confidenceScore": confidence_score,
        "latencyMs": latency_ms,
        "retrievedChunksCount": len(context_docs)
    }


def get_vectorstore_health() -> Dict[str, Any]:
    """Returns vectorstore connection and chunk count."""
    try:
        vs = get_vectorstore()
        count = vs._collection.count()
        return {"status": "healthy", "indexedChunkCount": count, "vectorstoreConnected": True}
    except Exception as e:
        return {"status": f"unhealthy: {e}", "indexedChunkCount": 0, "vectorstoreConnected": False}


async def get_rag_statistics() -> Dict[str, Any]:
    """
    Aggregates statistics from the rag_logs MongoDB collection and ChromaDB.
    """
    health = get_vectorstore_health()

    try:
        db = await get_db()
        total_queries = await db["rag_logs"].count_documents({})

        # Most searched documents
        pipeline = [
            {"$unwind": "$retrievedDocuments"},
            {"$group": {"_id": "$retrievedDocuments", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": 5}
        ]
        top_docs = await db["rag_logs"].aggregate(pipeline).to_list(5)
        most_searched = [d["_id"] for d in top_docs if d["_id"]]

        # Estimate unique indexed documents
        vs = get_vectorstore()
        all_meta = vs.get(include=["metadatas"])
        sources = set(m.get("source", "unknown") for m in all_meta.get("metadatas", []))

        return {
            "indexedDocuments": len(sources),
            "totalChunks": health["indexedChunkCount"],
            "recentQueryCount": total_queries,
            "mostSearchedPolicies": most_searched
        }
    except Exception as e:
        return {
            "indexedDocuments": 0,
            "totalChunks": health["indexedChunkCount"],
            "recentQueryCount": 0,
            "mostSearchedPolicies": []
        }
