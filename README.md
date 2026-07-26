# RetentionAI

RetentionAI is an AI-powered HR analytics platform for employee attrition-risk analysis and evidence-based retention support. This repository currently contains only the application foundation: frontend and service health checks, configuration, documentation, and the planned module layout.

## Tech Stack

- Frontend: React, Vite, Tailwind CSS, Redux Toolkit, React Router, Axios, Recharts, React Hook Form, and Zod.
- Backend: Node.js, Express, JWT, bcrypt, Mongoose, Zod, and supporting security middleware.
- AI service: Python, FastAPI, Pandas, NumPy, scikit-learn, XGBoost, Joblib, SHAP, DistilBERT, VADER, LangChain, ChromaDB, and Groq.
- Deployment targets: Vercel, Render, and MongoDB Atlas.

## Repository Structure

```text
client/       React/Vite frontend
server/       Express backend with health route
ai-service/   FastAPI AI service with health route
docs/         Approved architecture and design documents
datasets/     Sanitized/anonymized dataset locations
models/       Versioned model-artifact locations
uploads/      Local development upload staging
scripts/      Repeatable development and operations scripts
tests/        Cross-service, integration, E2E, and manual test assets
```

## Setup Instructions

Prerequisites: Node.js 20 or later, npm 10 or later, and Python 3.11 or later.

```powershell
# Frontend
cd client
npm install
Copy-Item .env.example .env
npm run dev

# Backend (separate terminal)
cd server
npm install
Copy-Item .env.example .env
npm run dev

# AI service (separate terminal)
cd ai-service
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn app.main:app --reload --port 8000
```

The frontend starts on the Vite address shown in the terminal. The backend health check is available at `http://localhost:5000/health`; the AI-service health check is available at `http://localhost:8000/health`.

## Installation Commands

```powershell
# Frontend
cd client
npm install

# Backend
cd server
npm install

# AI service
cd ai-service
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## Git Initialization

```powershell
git init
git add .
git commit -m "chore(repo): initialize retentionai foundation"
git branch -M main
git checkout -b develop
```

## Development Workflow

1. Read the documents in `docs/` before implementing a feature.
2. Create a focused branch from `develop` using the conventions in the Repository Development Blueprint.
3. Keep frontend, backend, and AI-service responsibilities separate.
4. Run formatting, linting, and the relevant tests before opening a pull request.
5. Do not commit secrets, real employee data, uploads, model binaries, or provider credentials.

See [Repository Development Blueprint](docs/Repository-Development-Blueprint.md), [SRS](docs/SRS.md), [SDD](docs/SDD.md), [Database Design](docs/Database-Design.md), and [Backend API Design](docs/Backend-API-Design.md).
