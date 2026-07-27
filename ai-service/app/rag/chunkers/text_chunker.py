import uuid
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
    
    # Add unique chunkId to metadata
    for i, chunk in enumerate(chunks):
        chunk.metadata["chunkId"] = str(uuid.uuid4())
        # Ensure pageNumber is stored if available
        if "page" in chunk.metadata:
            chunk.metadata["pageNumber"] = chunk.metadata["page"]
            
    return chunks
