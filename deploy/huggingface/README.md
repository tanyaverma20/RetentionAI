---
title: RetentionAI AI Service
emoji: 🧠
colorFrom: indigo
colorTo: purple
sdk: docker
app_port: 7860
pinned: false
---

# RetentionAI — AI Service

FastAPI service backing the RetentionAI platform: attrition prediction
(XGBoost/LightGBM/CatBoost), SHAP explainability, NLP employee-voice analysis,
RAG knowledge search over HR policy documents, and the agentic decision engine.

This Space is **not a public demo** — it is the backend for the RetentionAI
Express API. Every route requires a bearer token (`AI_SERVICE_TOKEN`) that must
match the one configured on the API server; unauthenticated requests are
rejected, so the Space being publicly reachable does not make its data or
inference endpoints publicly usable.

## Health

- `GET /health` — liveness (no auth).
- `GET /health/deep` — checks Mongo connectivity, model/SHAP readiness, memory,
  CPU, and pipeline latency.

## Required secrets

Set these in **Settings → Variables and secrets**. The service refuses to start
without the first two (see `app/config.py`'s `validate_startup_config`).

| Secret | Why |
|---|---|
| `AI_SERVICE_TOKEN` | Shared bearer secret. Must match the Express API's copy exactly, or every AI feature returns 401. |
| `GROQ_API_KEY` | Powers RAG chat and the decision engine's LLM reasoning. Required whenever `AI_SERVICE_ENV=production`. |
| `MONGODB_URI` | Atlas connection string. Must point at the same cluster and database as the Express API. |
| `MONGODB_DB_NAME` | Defaults to `retentionai`; must match the API. |
| `AI_SERVICE_ENV` | Set to `production`. |

## Notes on this deployment

- Model weights (`SamLowe/roberta-base-go_emotions`,
  `valhalla/distilbart-mnli-12-3`, `all-MiniLM-L6-v2`, spaCy `en_core_web_sm`)
  are baked into the image. A free Space has no persistent disk, so anything
  fetched at runtime would be re-fetched on every restart — and the service
  runs with `HF_HUB_OFFLINE=1` by default, which would make that fetch fail.
- `chroma_db/` is likewise ephemeral: the vector store is rebuilt from indexed
  documents rather than persisted across restarts.
