# Installation Guide

## Prerequisites

- Node.js 20+ and npm 10+
- Python 3.11+
- MongoDB 7 (local install, Docker, or Atlas)
- A [Groq API key](https://console.groq.com) (free tier works) for the Decision Engine's LLM reasoning step

## 1. MongoDB

Any of:
- **Local:** install MongoDB Community Server, or run `mongod` however you normally do.
- **Docker:** `docker run -d -p 27017:27017 --name retentionai-mongo mongo:7`
- **Atlas:** create a free M0 cluster, copy the connection string.

## 2. AI Service (FastAPI)

```bash
cd ai-service
python -m venv .venv
# Windows: .venv\Scripts\activate   |   macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env: set GROQ_API_KEY, AI_SERVICE_TOKEN (must match server/.env's copy), MONGODB_URI
uvicorn app.main:app --reload --port 8000
```

First startup downloads NLP models (DistilBERT, sentence-transformers) —
expect 20-40s. Verify: `curl http://localhost:8000/health/deep`.

If no trained model exists yet at `models/active/`, train one:
```bash
python train_model.py
```

## 3. Server (Express)

```bash
cd server
npm install
cp .env.example .env
# Edit .env: MONGODB_URI, JWT_ACCESS_SECRET/JWT_REFRESH_SECRET (32+ chars each),
# AI_SERVICE_TOKEN (must match ai-service/.env), CORS_ORIGINS
npm run dev
```

On first run, this seeds demo accounts — see the console output for
`admin@example.test` / `Admin#12345` and one demo login per role
(`hr.manager@…`, `hr.director@…`, `chro@…`, `ceo@…`, `dept.manager@…`,
`employee@…`). Verify: `curl http://localhost:5000/health/deep`.

## 4. Client (React)

```bash
cd client
npm install
cp .env.example .env
# VITE_API_BASE_URL defaults to http://localhost:5000/api/v1 — fine for local dev
npm run dev
```

Open the URL Vite prints (typically `http://localhost:5173`) and log in with
`admin@example.test` / `Admin#12345`.

## Verifying the full stack

```bash
curl http://localhost:5000/health/deep    # server: checks Mongo + ai-service reachability
curl http://localhost:8000/health/deep    # ai-service: checks Mongo + model/NLP/vectorstore readiness
```

Both should report `"status": "UP"`. If `ai-service` is `DEGRADED`, check its
logs — the model bundle or NLP models likely failed to load (see
[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)).

## Docker alternative

Skip steps 1-4 entirely: see [docs/deployment/docker-vps.md](./deployment/docker-vps.md)'s
"local" usage, or simply:
```bash
cp .env.example .env  # fill in secrets
docker compose up -d --build
```
