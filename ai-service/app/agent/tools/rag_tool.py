"""
app/agent/tools/rag_tool.py
============================
Tool wrapper: queries the RAG knowledge base for relevant HR policies.
Calls the existing rag_service — does NOT rebuild ChromaDB.
"""

from app.rag.vectorstore.chroma_store import get_vectorstore
from typing import Dict, Any, List


def run_rag_retrieval(query: str, top_k: int = 3) -> Dict[str, Any]:
    """
    Retrieves relevant HR policy chunks from ChromaDB for a given query string.
    Used by the agent to ground its recommendations in actual company policy.
    """
    try:
        vs = get_vectorstore()
        results = vs.similarity_search_with_relevance_scores(query, k=top_k)
        
        if not results:
            return {
                "success": False,
                "policies": [],
                "policyReferences": [],
                "error": "No relevant policy documents found."
            }
        
        policies = []
        references = []
        for doc, score in results:
            if score > 0.3:  # Similarity threshold
                doc_name = doc.metadata.get("documentName", doc.metadata.get("source", "Unknown Policy"))
                page = doc.metadata.get("pageNumber", doc.metadata.get("page", "N/A"))
                
                policies.append({
                    "documentName": doc_name,
                    "pageNumber": page,
                    "content": doc.page_content[:400],
                    "relevanceScore": round(score, 3)
                })
                ref = f"{doc_name}" + (f", p.{page}" if page and page != "N/A" else "")
                if ref not in references:
                    references.append(ref)
        
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
