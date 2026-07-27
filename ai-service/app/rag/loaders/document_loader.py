import os
import glob
from langchain_community.document_loaders import PyPDFLoader, Docx2txtLoader, TextLoader, UnstructuredMarkdownLoader
from langchain_core.documents import Document
from typing import List

def load_documents(directory: str) -> List[Document]:
    """
    Loads all PDF, DOCX, TXT, and MD files from the specified directory.
    Returns a list of LangChain Document objects.
    """
    documents = []
    
    if not os.path.exists(directory):
        print(f"Directory {directory} does not exist.")
        return documents

    # Support multiple formats
    for file_path in glob.glob(os.path.join(directory, "**/*.*"), recursive=True):
        ext = file_path.split('.')[-1].lower()
        loader = None
        
        try:
            if ext == "pdf":
                loader = PyPDFLoader(file_path)
            elif ext == "docx":
                loader = Docx2txtLoader(file_path)
            elif ext == "txt":
                loader = TextLoader(file_path, encoding="utf-8")
            elif ext == "md":
                loader = UnstructuredMarkdownLoader(file_path)
                
            if loader:
                docs = loader.load()
                # Ensure source metadata is present
                for d in docs:
                    d.metadata["source"] = os.path.basename(file_path)
                    d.metadata["documentName"] = os.path.basename(file_path)
                documents.extend(docs)
                print(f"Loaded {len(docs)} pages/sections from {file_path}")
        except Exception as e:
            print(f"Failed to load {file_path}: {e}")
            
    return documents
