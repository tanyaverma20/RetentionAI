"""
app/agent/tools/rag_tool.py
============================
Tool wrapper: queries the RAG knowledge base for relevant HR policies.
Reuses app.rag.services.rag_service.search_knowledge() (the Knowledge
Intelligence sprint's semantic search) instead of talking to ChromaDB
directly — this was previously a second, independent Chroma access path
that duplicated (and didn't benefit from fixes to) the real RAG search
logic. Does NOT rebuild ChromaDB or the RAG module.
"""

from typing import Dict, Any

from app.rag.services.rag_service import search_knowledge

RELEVANCE_THRESHOLD = 0.3


def run_rag_retrieval(query: str, top_k: int = 3) -> Dict[str, Any]:
    """
    Retrieves relevant HR policy chunks for a given query string via the
    shared RAG search service. Used to ground recommendations in actual
    company policy.
    """
    try:
        result = search_knowledge(query, mode="semantic", top_k=top_k)
        results = result.get("results", [])

        if not results:
            return {
                "success": False,
                "policies": [],
                "policyReferences": [],
                "error": "No relevant policy documents found."
            }

        policies = []
        references = []
        for r in results:
            score = r.get("similarityScore") or 0.0
            if score > RELEVANCE_THRESHOLD:
                doc_name = r.get("documentName", "Unknown Policy")
                page = r.get("pageNumber")
                policies.append({
                    "documentName": doc_name,
                    "pageNumber": page if page is not None else "N/A",
                    "content": r.get("content", "")[:400],
                    "relevanceScore": round(score, 3),
                })
                ref = doc_name + (f", p.{page}" if page is not None else "")
                if ref not in references:
                    references.append(ref)

        if not policies:
            return {
                "success": False,
                "policies": [],
                "policyReferences": [],
                "error": "No sufficiently relevant policy documents found."
            }

        return {
            "success": True,
            "policies": policies,
            "policyReferences": references
        }
    except Exception as e:
        return {
            "success": False,
            "policies": [],
            "policyReferences": [],
            "error": str(e)
        }
