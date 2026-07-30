import os
from langchain_groq import ChatGroq

# Cache the LLM
_llm = None

# Reused everywhere a RAG-generated answer is needed. GROQ_MODEL_NAME is
# documented in .env.example but was never actually read anywhere in the
# codebase — wiring it here means an operator can change the model without a
# code change, without touching how the LLM is invoked/reused elsewhere.
_DEFAULT_MODEL = "llama-3.3-70b-versatile"


def get_llm():
    """
    Returns the cached ChatGroq client (reused across every RAG query — the
    existing LLM integration/provider, unchanged).
    """
    global _llm
    if _llm is None:
        groq_api_key = os.getenv("GROQ_API_KEY", "")
        if not groq_api_key:
            raise ValueError("GROQ_API_KEY environment variable is missing.")

        _llm = ChatGroq(
            model=os.getenv("GROQ_MODEL_NAME", _DEFAULT_MODEL),
            api_key=groq_api_key,
            temperature=0.0,  # Strict, grounded answers
            timeout=float(os.getenv("RAG_LLM_TIMEOUT_SECONDS", "30")),
        )
    return _llm
