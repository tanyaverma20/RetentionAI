# RetentionAI

RetentionAI is a production-ready, enterprise employee-retention platform:
ML attrition prediction, SHAP explainability, NLP-driven employee
intelligence, a RAG-backed HR knowledge base, AI-generated decision
recommendations, an executive workforce dashboard, and a full HR
workflow-automation suite (interventions, tasks, approvals, notifications,
audit) — all wired into one HRMS covering employees, departments,
attendance, performance, training, and promotions.

**Version:** 1.0.0 · See [CHANGELOG.md](./CHANGELOG.md) for release notes.

## Architecture

```text
React (client)  →  Express API (server)  →  MongoDB
                          ↓
                  FastAPI AI Service (ai-service)
                          ↓
        Prediction → SHAP → Employee Intelligence (NLP)
                → Knowledge Intelligence (RAG) → Decision Intelligence
                          ↓
              Executive Dashboard  →  Workflow Automation
```

See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for the full diagram and
component breakdown.

## Repository Structure

```text
client/             React 18 + Vite + Redux Toolkit + Tailwind frontend
server/             Express API: HRMS, auth/RBAC, workflow automation, executive dashboard
ai-service/         FastAPI: prediction, SHAP, NLP, RAG, decision engine
docs/               Architecture, API, deployment, and testing documentation
docs/deployment/    Platform-specific deployment guides (Render, Railway, AWS, Azure, DigitalOcean, Docker VPS)
scripts/ops/        Database backup/restore scripts
server/scripts/     DB consistency check, load test harness
datasets/, models/  Training data and versioned model artifacts (gitignored)
uploads/            Local file storage (attachments, reports, documents — gitignored)
.github/workflows/  CI pipeline (lint, test, build, Docker build)
docker-compose.yml  One-command local/production stack (all 4 services)
```

## Quickstart — Docker (recommended)

```bash
cp .env.example .env   # fill in real secrets — see docs/deployment/README.md
docker compose up -d --build
```

Frontend: `http://localhost` · API: `http://localhost:5000/api/v1` · API docs: `http://localhost:5000/api-docs` · AI service docs: `http://localhost:8000/docs`

## Quickstart — Manual (development)

Prerequisites: Node.js 20+, npm 10+, Python 3.11+, MongoDB (local or Atlas).

```bash
# Backend
cd server && npm install && cp .env.example .env && npm run dev

# AI service (separate terminal)
cd ai-service && python -m venv .venv && .venv\Scripts\activate
pip install -r requirements.txt && cp .env.example .env
uvicorn app.main:app --reload --port 8000

# Frontend (separate terminal)
cd client && npm install && cp .env.example .env && npm run dev
```

Health checks: `GET /health` (fast liveness) and `GET /health/deep` (Mongo,
AI service, memory/CPU, pipeline latency) on both the Express server (5000)
and the AI service (8000).

## Deployment

Recommended production architecture: **Vercel** (React client) + **Render**
(Express API and FastAPI AI service, both Docker-based) + **MongoDB Atlas**
(database). Deployment configs are already in the repo:

- [`client/vercel.json`](./client/vercel.json) — Vercel build/SPA-routing config
- [`render.yaml`](./render.yaml) — Render Blueprint for both backend services
- [`server/Procfile`](./server/Procfile) / [`ai-service/Procfile`](./ai-service/Procfile) — for Railway/Heroku-style buildpack deploys as an alternative to Docker

Full step-by-step walkthrough (accounts needed, exact dashboard steps, env
var wiring): [docs/deployment/PRODUCTION-DEPLOYMENT-GUIDE.md](./docs/deployment/PRODUCTION-DEPLOYMENT-GUIDE.md).
Every environment variable across all three services, and which ones must
match exactly across services: [docs/ENVIRONMENT-VARIABLES.md](./docs/ENVIRONMENT-VARIABLES.md).

## Documentation

| Doc | Covers |
|---|---|
| [ARCHITECTURE.md](./docs/ARCHITECTURE.md) | System diagram, data flow, service responsibilities |
| [INSTALLATION.md](./docs/INSTALLATION.md) | Detailed local setup, all three services |
| [deployment/PRODUCTION-DEPLOYMENT-GUIDE.md](./docs/deployment/PRODUCTION-DEPLOYMENT-GUIDE.md) | Recommended architecture, step-by-step Vercel + Render + Atlas walkthrough |
| [deployment/](./docs/deployment/) | Render, Railway, AWS EC2, Azure, DigitalOcean, Docker VPS guides |
| [ENVIRONMENT-VARIABLES.md](./docs/ENVIRONMENT-VARIABLES.md) | Every env var across all 3 services, cross-service consistency requirements |
| API docs (`/api-docs`) | Live Swagger UI — every Express endpoint, schemas, examples |
| AI service docs (`/docs`) | FastAPI's auto-generated OpenAPI UI |
| [DATABASE.md](./docs/DATABASE.md) | Collections, relationships, indexes, backup/restore |
| [AI-PIPELINE.md](./docs/AI-PIPELINE.md) | Prediction → SHAP → Intelligence → Knowledge → Decision flow |
| [ADMIN-MANUAL.md](./docs/ADMIN-MANUAL.md) | Role matrix, admin operations, automation jobs |
| [DEVELOPER-GUIDE.md](./docs/DEVELOPER-GUIDE.md) | Codebase conventions, adding a new endpoint/model |
| [TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md) | Common failure modes and fixes |
| [Security-Audit-Report.md](./docs/Security-Audit-Report.md) | Sprint 10 security hardening review |
| [Load-Testing-Report.md](./docs/Load-Testing-Report.md) | Benchmark results and known scaling limits |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Branching, commit style, PR checklist |

## Testing

```bash
cd server && npm test          # unit + integration (node --test)
cd ai-service && pytest        # ML/SHAP/NLP/RAG/decision engine
cd client && npm run build     # type/build check (no separate test suite yet — see Developer Guide)
```

CI runs lint + tests + builds + Docker image builds on every push/PR — see
[.github/workflows/ci.yml](./.github/workflows/ci.yml).

## License

[MIT](./LICENSE)
