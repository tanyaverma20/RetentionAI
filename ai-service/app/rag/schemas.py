from pydantic import BaseModel, Field
from typing import List, Optional

class RAGQueryRequest(BaseModel):
    question: str
    organizationId: Optional[str] = None
    userId: Optional[str] = None
    filterDocument: Optional[str] = None  # Filter by documentName/source
    documentType: Optional[str] = None
    topK: Optional[int] = Field(4, ge=1, le=20)

class SourceDocument(BaseModel):
    documentName: str
    documentId: Optional[str] = None
    pageNumber: Optional[int] = None
    chunkId: Optional[str] = None
    content: str
    similarityScore: Optional[float] = None

class RAGQueryResponse(BaseModel):
    answer: str
    sourceDocuments: List[SourceDocument]
    confidenceScore: float
    latencyMs: float
    retrievedChunksCount: int

class RAGIndexRequest(BaseModel):
    directory: Optional[str] = None  # Defaults to knowledge_base/ — internal use only, never exposed to a public path param

class RAGIndexResponse(BaseModel):
    success: bool
    message: str
    documentsIndexed: int
    chunksIndexed: int

class RAGHealthResponse(BaseModel):
    status: str
    indexedChunkCount: int
    vectorstoreConnected: bool

class RAGStatisticsResponse(BaseModel):
    indexedDocuments: int
    totalChunks: int
    recentQueryCount: int
    mostSearchedPolicies: List[str]
    querySuccessRate: Optional[float] = None


# ---------------------------------------------------------------------------
# Knowledge Intelligence sprint — upload / reindex / delete / search / detail
# ---------------------------------------------------------------------------

class DocumentIndexRequest(BaseModel):
    """
    Used by both POST /documents/upload and POST /documents/reindex — both
    are "(re)index this one file with this metadata", the only difference is
    whether chunks already exist for the documentId (index_single_document
    deletes-then-adds either way, so it's idempotent regardless).
    """
    documentId: str
    filePath: str = Field(..., description="Server-controlled path (set by Express, never a raw client path) to the uploaded file")
    organizationId: Optional[str] = None
    documentType: Optional[str] = None
    tags: Optional[List[str]] = None
    uploadedBy: Optional[str] = None
    uploadDate: Optional[str] = None
    version: Optional[int] = None

class DocumentDeleteRequest(BaseModel):
    documentId: str

class SearchResult(BaseModel):
    documentName: str
    documentId: Optional[str] = None
    pageNumber: Optional[int] = None
    chunkId: Optional[str] = None
    content: str
    similarityScore: Optional[float] = None

class SearchResponse(BaseModel):
    mode: str
    results: List[SearchResult]
    resultCount: int

class DocumentChunkPreview(BaseModel):
    chunkId: Optional[str] = None
    pageNumber: Optional[int] = None
    preview: str

class DocumentDetailResponse(BaseModel):
    documentId: str
    chunkCount: int
    chunks: List[DocumentChunkPreview]
