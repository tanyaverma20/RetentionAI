# RAG Module Architecture

The RetentionAI RAG (Retrieval-Augmented Generation) module provides a policy-grounded question-answering system for HR managers and employees. It retrieves relevant excerpts from official company documents before generating answers, ensuring the LLM **only responds based on actual company policy**, not hallucinated information.

## Data Flow

```
User Question
     │
     ▼
POST /rag/query
     │
     ▼
[ Retriever ] ─────────────► [ ChromaDB Vector Store ]
     │                              ▲
     │ Top-K similar chunks         │
     │                        Indexed via:
     ▼                        POST /rag/index
[ LangChain RAG Chain ]       │
     │                        ▼
     │  Context + Question   [ Document Loader ]
     │                         PDF, DOCX, TXT, MD
     ▼                        │
  Groq LLM                    ▼
(Llama 3.3 70B)          [ Text Chunker ]
     │                   800 chars / 150 overlap
     ▼                        │
Grounded Answer               ▼
     │                  [ Embeddings ]
     ▼                  all-MiniLM-L6-v2
Response + Sources            │
                              ▼
                         [ ChromaDB ]
                         Persisted to disk
```

## Project Structure

```
ai-service/
├── knowledge_base/             # Place your HR PDF/DOCX/MD files here
│   ├── Employee Handbook.pdf
│   ├── Leave Policy.pdf
│   └── ...
├── chroma_db/                  # Persistent vector store (auto-created)
└── app/
    └── rag/
        ├── loaders/
        │   └── document_loader.py   # PDF, DOCX, TXT, MD loading
        ├── chunkers/
        │   └── text_chunker.py      # RecursiveCharacterTextSplitter
        ├── embeddings/
        │   └── embedding_manager.py # Cached all-MiniLM-L6-v2
        ├── vectorstore/
        │   └── chroma_store.py      # Persistent ChromaDB operations
        ├── prompts/
        │   └── rag_prompt.py        # Strict grounding prompt template
        ├── chains/
        │   └── rag_chain.py         # LangChain retrieval chain + Groq LLM
        ├── services/
        │   └── rag_service.py       # Business logic, query logging
        └── schemas.py               # Pydantic request/response models
```

## Indexing Pipeline

1. **Place documents** in the `knowledge_base/` directory.
2. **Call** `POST /rag/index` to trigger ingestion.
3. The loader reads all PDF, DOCX, TXT, and MD files and extracts text with metadata (source filename, page number).
4. The chunker splits text into 800-character chunks with 150-character overlap using LangChain's `RecursiveCharacterTextSplitter`.
5. Each chunk is assigned a unique `chunkId` via UUID.
6. The embedding model (`all-MiniLM-L6-v2`) converts each chunk into a 384-dimensional vector.
7. Vectors + metadata are persisted to ChromaDB on disk (`chroma_db/`).

## Chunking Strategy

| Parameter | Value |
|---|---|
| Splitter | `RecursiveCharacterTextSplitter` |
| Chunk Size | 800 characters |
| Chunk Overlap | 150 characters |
| Metadata Stored | `source`, `pageNumber`, `chunkId`, `documentName` |

The recursive splitter first tries to break on paragraph boundaries (`\n\n`), then newlines, then spaces, preserving semantic coherence.

## Embedding Model

- **Model:** `sentence-transformers/all-MiniLM-L6-v2`
- **Dimensions:** 384
- **Source:** Hugging Face (via LangChain `SentenceTransformerEmbeddings`)
- **Caching:** The model is loaded once into memory on FastAPI startup and reused across all requests.

## Retrieval Workflow

On each `POST /rag/query`:
1. The user's question is embedded using `all-MiniLM-L6-v2`.
2. ChromaDB performs a cosine similarity search and returns the top **4 most relevant chunks** (`k=4`).
3. The chunks and the original question are formatted into the grounding prompt.
4. The Groq LLM (`llama-3.3-70b-versatile`) generates a response.
5. If no relevant context exists, the LLM is instructed to respond: *"The answer is not available in the company's policy documents."*

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/rag/query` | Ask a question and get a grounded answer |
| `POST` | `/rag/index` | Index documents from `knowledge_base/` |
| `POST` | `/rag/reindex` | Clear and re-index all documents |
| `GET` | `/rag/documents` | List all indexed documents |
| `GET` | `/rag/health` | Check vectorstore health |
| `GET` | `/rag/statistics` | Dashboard stats (query count, top policies) |

## Query Request / Response

**Request:**
```json
{
  "question": "How many sick leaves do I get per year?",
  "userId": "user_abc123",
  "filterDocument": "Leave Policy.pdf"
}
```

**Response:**
```json
{
  "answer": "According to the Leave Policy, employees are entitled to 12 sick leave days per year.",
  "sourceDocuments": [
    {
      "documentName": "Leave Policy.pdf",
      "pageNumber": 4,
      "chunkId": "uuid-here",
      "content": "...sick leave entitlement is 12 days per calendar year..."
    }
  ],
  "confidenceScore": 0.85,
  "latencyMs": 1243.5,
  "retrievedChunksCount": 4
}
```

## MongoDB Logging (`rag_logs`)

Every query is logged for analytics and audit:

```json
{
  "query": "How many sick days...",
  "response": "According to the Leave Policy...",
  "retrievedDocuments": ["Leave Policy.pdf"],
  "latencyMs": 1243.5,
  "userId": "user_abc123",
  "timestamp": "2026-07-27T10:00:00Z"
}
```

## Environment Variables Required

Add to `ai-service/.env`:

```
GROQ_API_KEY=your_groq_api_key_here
```

## Getting Started

1. Add HR policy documents to `knowledge_base/`.
2. Start the AI service: `uvicorn app.main:app --reload`
3. Index documents: `POST /rag/index`
4. Query: `POST /rag/query`
