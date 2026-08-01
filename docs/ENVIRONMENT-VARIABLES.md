# RetentionAI — Environment Variable Reference

One consolidated reference across all three services. Each service also has
its own `.env.example` (development defaults) and `production.env.example`
(production template) — this file exists to show them side by side and flag
which values must match **across** services.

Values marked **Secret** must never be committed; all three services'
`.gitignore` already excludes `.env`/`.env.*` except `.env.example`.

## Cross-service consistency requirements

These are the values most likely to cause a silent production bug if they
don't match exactly across services:

| Variable | Must be identical in | Why |
|---|---|---|
| `AI_SERVICE_TOKEN` | `server/.env` **and** `ai-service/.env` | The Express API authenticates to the AI service with this as a bearer token; a mismatch causes every AI feature (predictions, SHAP, NLP, RAG, recommendations) to fail with 401. |
| `MONGODB_URI` / `MONGODB_DB_NAME` | `server/.env` **and** `ai-service/.env` | Both services read and write the same database — pointing at different databases silently splits your data in two. |

## Express API (`server/.env`)

| Variable | Required | Default | Notes |
|---|---|---|---|
| `NODE_ENV` | No | `development` | Set to `production` on a deployed instance — this also activates the placeholder-secret and wildcard-CORS startup guards in `src/config/env.js`. |
| `PORT` | No | `5000` | |
| `MONGODB_URI` | **Yes** | — | Atlas connection string in production. |
| `MONGODB_DB_NAME` | No | `retentionai` | |
| `JWT_ACCESS_SECRET` | **Yes** | — | **Secret.** 32+ random chars. Distinct from `JWT_REFRESH_SECRET`. |
| `JWT_REFRESH_SECRET` | **Yes** | — | **Secret.** 32+ random chars. Distinct from `JWT_ACCESS_SECRET`. |
| `JWT_ACCESS_TTL` | No | `15m` | |
| `JWT_REFRESH_TTL` | No | `7d` | |
| `CORS_ORIGINS` | **Yes** | — | Comma-separated origins (scheme+host). An entry may use `*` to match within one DNS label — required for platforms that mint a hostname per deploy, e.g. `https://myapp-*-myteam.vercel.app` covers every Vercel per-deployment URL for that project. A bare `*`, or a whole-domain wildcard like `https://*.vercel.app` (which would trust every tenant on that platform), is refused at startup in production. See `server/src/config/corsOrigins.js`. |
| `BCRYPT_SALT_ROUNDS` | No | `12` | |
| `PASSWORD_RESET_TTL_MINUTES` | No | `30` | |
| `AI_SERVICE_URL` | No | `http://127.0.0.1:8000` | Set to the deployed AI service's URL in production. |
| `AI_SERVICE_TOKEN` | **Yes** | — | **Secret.** Must match `ai-service/.env`'s copy exactly. |
| `AI_SERVICE_TIMEOUT_MS` | No | `10000` | |
| `LOG_LEVEL` | No | `info` | |

## AI Service (`ai-service/.env`)

| Variable | Required | Default | Notes |
|---|---|---|---|
| `AI_SERVICE_ENV` | No | — | Set to `production` to enforce startup validation (missing `GROQ_API_KEY`/`AI_SERVICE_TOKEN` aborts startup instead of booting broken). |
| `AI_SERVICE_HOST` | No | `0.0.0.0` | |
| `AI_SERVICE_PORT` | No | `8000` | |
| `AI_SERVICE_TOKEN` | **Yes** | — | **Secret.** Must match `server/.env`'s copy exactly. |
| `AI_MODELS_OFFLINE` | No | — | Keep `true` in production — the Docker image bakes in the spaCy model, so no network fetch should be needed on every startup. |
| `MONGODB_URI` | **Yes** | — | Must match `server/.env`. |
| `MONGODB_DB_NAME` | No | `retentionai` | Must match `server/.env`. |
| `MODEL_ARTIFACT_PATH` | No | `../models/active` | Where the trained `.joblib` bundle is read/written. In Docker, mount a persistent volume here (see `render.yaml`'s `disk` block) or the trained model is lost on every redeploy. |
| `MODEL_METADATA_PATH` | No | same as above | |
| `CHROMA_PERSIST_DIRECTORY` | No | `./chroma_db` | ChromaDB vector store location — also needs a persistent volume in production. |
| `GROQ_API_KEY` | **Yes** (if `AI_SERVICE_ENV=production`) | — | **Secret.** Powers the RAG chat and Agentic AI recommendation reasoning. |
| `GROQ_MODEL_NAME` | No | `llama-3.1-8b-instant` | Only affects the RAG chat path (`app/rag/chains/rag_chain.py`) — the separate Agentic AI recommendation path (`app/agent/chains/reasoning_chain.py`) currently hardcodes `llama-3.3-70b-versatile` directly and does not read this variable. Flagged here so a future config change doesn't silently miss half the LLM call sites. |
| `EMBEDDING_MODEL_NAME` | No | `all-MiniLM-L6-v2` | |
| `NLP_MODEL_NAME` | No | — | Not currently read by the NLP pipeline (`app/nlp/analyzer.py` uses fixed HuggingFace model names) — present in the template for forward compatibility only. |
| `MAX_RETRIEVED_CHUNKS` | No | `5` | |
| `AI_REQUEST_TIMEOUT_MS` / `NLP_INFERENCE_TIMEOUT_SECONDS` | No | varies | |
| `LOG_LEVEL` | No | `info` | |

## React Client (`client/.env`)

Vite bakes these in at **build time**, not read at runtime — set them before
`npm run build`, or pass as Docker build args / a platform's build-time env
var setting (Vercel's project env vars apply at build time automatically).

| Variable | Required | Default | Notes |
|---|---|---|---|
| `VITE_APP_NAME` | No | `RetentionAI` | |
| `VITE_API_BASE_URL` | **Yes** (production) | `http://localhost:5000/api/v1` | Must point at the deployed Express API's `/api/v1` path. |
| `VITE_ENVIRONMENT` | No | `development` | |
