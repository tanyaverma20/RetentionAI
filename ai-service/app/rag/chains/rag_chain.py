import os
from langchain_groq import ChatGroq
from langchain.chains.combine_documents import create_stuff_documents_chain
from langchain.chains import create_retrieval_chain
from app.rag.prompts.rag_prompt import prompt_template
from app.rag.vectorstore.chroma_store import get_vectorstore

# Cache the LLM and Chain
_llm = None
_rag_chain = None

def get_llm():
    global _llm
    if _llm is None:
        groq_api_key = os.getenv("GROQ_API_KEY", "")
        if not groq_api_key:
            raise ValueError("GROQ_API_KEY environment variable is missing.")
            
        _llm = ChatGroq(
            model="llama-3.3-70b-versatile", # or llama3-70b-8192 depending on exact groq model availability
            api_key=groq_api_key,
            temperature=0.0 # Strict answers
        )
    return _llm

def get_rag_chain():
    global _rag_chain
    if _rag_chain is None:
        llm = get_llm()
        
        # 1. Create document chain (combines context + prompt -> LLM)
        document_chain = create_stuff_documents_chain(llm, prompt_template)
        
        # 2. Create retriever from our vector store
        vectorstore = get_vectorstore()
        retriever = vectorstore.as_retriever(search_kwargs={"k": 4})
        
        # 3. Create full RAG chain
        _rag_chain = create_retrieval_chain(retriever, document_chain)
        
    return _rag_chain
