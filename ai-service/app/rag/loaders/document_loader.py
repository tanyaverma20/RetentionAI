import os
import glob
from langchain_community.document_loaders import PyPDFLoader, Docx2txtLoader, TextLoader, UnstructuredMarkdownLoader
from langchain_core.documents import Document
from typing import List, Optional, Dict, Any

SUPPORTED_EXTENSIONS = {"pdf", "docx", "txt", "md"}


def _loader_for(file_path: str, ext: str):
    if ext == "pdf":
        return PyPDFLoader(file_path)
    if ext == "docx":
        return Docx2txtLoader(file_path)
    if ext == "txt":
        return TextLoader(file_path, encoding="utf-8")
    if ext == "md":
        return UnstructuredMarkdownLoader(file_path)
    return None


def load_single_document(file_path: str, metadata: Optional[Dict[str, Any]] = None) -> List[Document]:
    """
    Loads one file (PDF/DOCX/TXT/MD) and stamps the given metadata (e.g.
    documentId, documentType, uploadedBy, uploadDate, version, tags) onto
    every resulting page/section — chunking later inherits this metadata
    automatically, which is what makes per-document filtering/deletion work.

    Raises ValueError for an unsupported extension or a missing file, so
    callers (the FastAPI upload/reindex endpoints) can map this to a clear
    400 instead of a generic 500.
    """
    if not os.path.exists(file_path):
        raise ValueError(f"File not found: {file_path}")

    ext = file_path.rsplit(".", 1)[-1].lower() if "." in file_path else ""
    if ext not in SUPPORTED_EXTENSIONS:
        raise ValueError(f"Unsupported file type: .{ext}. Supported types: {sorted(SUPPORTED_EXTENSIONS)}")

    loader = _loader_for(file_path, ext)
    docs = loader.load()

    base_metadata = {
        "source": os.path.basename(file_path),
        "documentName": os.path.basename(file_path),
        **(metadata or {}),
    }
    for d in docs:
        d.metadata.update(base_metadata)

    return docs


def load_documents(directory: str) -> List[Document]:
    """
    Loads all PDF, DOCX, TXT, and MD files from the specified directory.
    Returns a list of LangChain Document objects.

    NOTE: `directory` must be a server-controlled path — never pass a
    caller-supplied path here. This is intentionally not parameterizable
    from any public API request (see knowledge_routes.py); the previous
    version of this module accepted an arbitrary directory straight from
    the request body, which was an unauthenticated arbitrary-directory-read
    vulnerability.
    """
    documents = []

    if not os.path.exists(directory):
        print(f"Directory {directory} does not exist.")
        return documents

    # Support multiple formats
    for file_path in glob.glob(os.path.join(directory, "**/*.*"), recursive=True):
        try:
            docs = load_single_document(file_path)
            documents.extend(docs)
            print(f"Loaded {len(docs)} pages/sections from {file_path}")
        except ValueError:
            continue  # unsupported extension in the directory — skip silently
        except Exception as e:
            print(f"Failed to load {file_path}: {e}")

    return documents
