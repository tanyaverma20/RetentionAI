import os
from langchain_community.vectorstores import Chroma
from app.rag.embeddings.embedding_manager import get_embeddings
from langchain_core.documents import Document
from typing import List

CHROMA_PERSIST_DIR = os.path.join(os.path.dirname(__file__), "../../../chroma_db")

def get_vectorstore() -> Chroma:
    """
    Returns the persistent ChromaDB vector store.
    """
    embeddings = get_embeddings()
    # Create dir if not exists
    os.makedirs(CHROMA_PERSIST_DIR, exist_ok=True)
    
    vectorstore = Chroma(
        collection_name="hr_knowledge_base",
        embedding_function=embeddings,
        persist_directory=CHROMA_PERSIST_DIR
    )
    return vectorstore

def index_documents(documents: List[Document]):
    """
    Adds a list of chunked documents to the vector store.
    """
    vectorstore = get_vectorstore()
    vectorstore.add_documents(documents)
    # Chroma automatically persists in newer versions, but we can call it if needed depending on version.

def clear_vectorstore():
    """
    Clears the existing vector store collection.
    """
    vectorstore = get_vectorstore()
    # Delete the collection
    vectorstore.delete_collection()
