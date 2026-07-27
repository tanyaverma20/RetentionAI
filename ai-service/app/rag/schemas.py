from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

class RAGQueryRequest(BaseModel):
    question: str
    userId: Optional[str] = None
    filterDocument: Optional[str] = None  # Filter by documentName

class SourceDocument(BaseModel):
    documentName: str
    pageNumber: Optional[int] = None
    chunkId: Optional[str] = None
    content: str

class RAGQueryResponse(BaseModel):
    answer: str
    sourceDocuments: List[SourceDocument]
    confidenceScore: float
    latencyMs: float
    retrievedChunksCount: int

class RAGIndexRequest(BaseModel):
    directory: Optional[str] = None  # Defaults to knowledge_base/

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
