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

def index_documents(documents: List[Document]) -> List[str]:
    """
    Adds a list of chunked documents to the vector store.
    Returns the Chroma-assigned IDs (== each chunk's chunkId, so callers can
    delete exactly these chunks later without a full reindex).
    """
    vectorstore = get_vectorstore()
    ids = [d.metadata["chunkId"] for d in documents]
    vectorstore.add_documents(documents, ids=ids)
    return ids

def delete_document_chunks(document_id: str):
    """
    Deletes every chunk belonging to one document (by documentId metadata) —
    used by document deletion and by reindexing a single document (old chunks
    must go before the new ones are added, otherwise stale duplicates remain).
    """
    vectorstore = get_vectorstore()
    vectorstore._collection.delete(where={"documentId": document_id})

def clear_vectorstore():
    """
    Clears the existing vector store collection.
    """
    vectorstore = get_vectorstore()
    # Delete the collection
    vectorstore.delete_collection()
