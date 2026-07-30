import hashlib
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document
from typing import List

def split_documents(documents: List[Document]) -> List[Document]:
    """
    Splits documents into semantic chunks.
    Chunk size: 800 tokens (approx characters here)
    Overlap: 150 characters
    """
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=800,
        chunk_overlap=150,
        length_function=len,
        is_separator_regex=False,
    )

    chunks = text_splitter.split_documents(documents)

    # chunkId is deterministic (documentId + chunk index + content hash), NOT
    # a random UUID — this is what makes indexing idempotent/incremental:
    # re-indexing unchanged text produces the exact same IDs, so Chroma
    # upserts in place instead of creating duplicate chunks every re-run.
    for i, chunk in enumerate(chunks):
        document_id = chunk.metadata.get("documentId", chunk.metadata.get("source", "unknown"))
        content_hash = hashlib.sha256(chunk.page_content.encode("utf-8")).hexdigest()[:16]
        chunk.metadata["chunkId"] = f"{document_id}-{i}-{content_hash}"
        # Ensure pageNumber is stored if available
        if "page" in chunk.metadata:
            chunk.metadata["pageNumber"] = chunk.metadata["page"]

    return chunks
