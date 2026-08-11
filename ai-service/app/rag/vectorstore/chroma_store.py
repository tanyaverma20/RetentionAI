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

def delete_document_chunks(document_id: str, organization_id: str = None):
    """
    Deletes every chunk belonging to one document (by documentId metadata and optional organizationId).
    """
    vectorstore = get_vectorstore()
    where_clause = {"documentId": document_id}
    if organization_id:
        where_clause = {"$and": [{"documentId": document_id}, {"organizationId": organization_id}]}
    vectorstore._collection.delete(where=where_clause)

def clear_vectorstore():
    """
    Clears the existing vector store collection.
    """
    vectorstore = get_vectorstore()
    # Delete the collection
    vectorstore.delete_collection()

def migrate_tenant_metadata(default_org_id: str = "60d5ec388832a828f8000000") -> int:
    """
    Safe, idempotent, duplication-free migration of existing ChromaDB chunks.
    Stamps organizationId = default_org_id on any legacy chunk missing organizationId.
    Does NOT delete, re-embed, or duplicate any vectors.
    """
    vectorstore = get_vectorstore()
    try:
        data = vectorstore._collection.get(include=["metadatas"])
        ids = data.get("ids", [])
        metadatas = data.get("metadatas", [])

        update_ids = []
        update_metadatas = []

        for chunk_id, meta in zip(ids, metadatas):
            if meta is None:
                meta = {}
            if "organizationId" not in meta or not meta["organizationId"]:
                updated_meta = dict(meta)
                updated_meta["organizationId"] = default_org_id
                update_ids.append(chunk_id)
                update_metadatas.append(updated_meta)

        if update_ids:
            vectorstore._collection.update(ids=update_ids, metadatas=update_metadatas)
            return len(update_ids)
        return 0
    except Exception as e:
        print(f"Error during ChromaDB tenant metadata migration: {e}")
        return 0

