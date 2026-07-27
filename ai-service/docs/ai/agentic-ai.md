# Agentic AI Orchestration Layer Documentation

## Overview
The **Agentic AI** module is the brain of the RetentionAI platform. It orchestrates the outputs of all existing AI components—ML predictions, SHAP explainability, NLP sentiment analysis, and Retrieval‑Augmented Generation (RAG) of HR policies—to generate **evidence‑based, policy‑grounded, personalized retention recommendations**.

## Architecture
```
└─ app/
   ├─ agent/
   │   ├─ __init__.py                # package marker
   │   ├─ schemas.py                 # Pydantic request/response models
   │   ├─ tools/
   │   │   ├─ ml_tool.py             # wrapper around prediction_service
   │   │   ├─ shap_tool.py           # wrapper around local_explainer
   │   │   ├─ nlp_tool.py            # wrapper around NLP insights repo
   │   │   └─ rag_tool.py            # wrapper around ChromaDB RAG store
   │   ├─ prompts/
   │   │   └─ recommendation_prompt.py  # strict, evidence‑grounded LLM prompt
   │   ├─ chains/
   │   │   └─ reasoning_chain.py    # LangChain chain that calls Groq LLM
   │   ├─ orchestrator/
   │   │   └─ agent_orchestrator.py  # async pipeline that builds evidence bundle
   │   └─ services/
   │       └─ agent_service.py       # persistence, batch handling, statistics
   └─ api/
       └─ agent_routes.py           # FastAPI endpoints
```

## Data Flow (Per Employee)
1. **ML Prediction** – `run_ml_prediction` obtains attrition risk, level, and confidence.
2. **SHAP Explanation** – `run_shap_explanation` extracts top risk/protective features and a narrative.
3. **NLP Insights** – `run_nlp_insights` pulls sentiment, burnout, resignation intent, and topic keywords.
4. **RAG Retrieval** – `run_rag_retrieval` builds a targeted query from the signals and fetches relevant policy chunks from ChromaDB.
5. **Evidence Bundle** – All signals are assembled into a dictionary that feeds the LLM.
6. **LLM Reasoning** – `run_reasoning_chain` invokes the Groq Llama‑3.3‑70B model with a **strict, non‑hallucinating prompt** and expects a JSON recommendation.
7. **Confidence Scoring** – A weighted score combines model confidence, data completeness, and signal strength.
8. **Persistence** – The final recommendation is stored in MongoDB (`agent_recommendations` collection).
9. **Response** – Structured data is returned via the FastAPI router.

## Security & RBAC
* The router is mounted under `/agent` and inherits the global **authentication & authorization middleware** defined in `main.py`. Only users with the **HR_MANAGER** or **ADMIN** role can call the recommendation endpoints (handled by the existing RBAC layer).

## Usage
### Single Recommendation
```bash
POST /agent/recommend
{
  "employeeId": "emp123",
  "employeeData": { ... },
  "userId": "hr_manager_01"
}
```
### Batch Recommendation
```bash
POST /agent/recommend/batch
{
  "employees": [
    {"employeeId": "emp123", "employeeData": { ... }},
    {"employeeId": "emp456", "employeeData": { ... }}
  ]
}
```
### Dashboard Endpoints
* `GET /agent/history` – recent recommendations.
* `GET /agent/employee/{id}` – history for a specific employee.
* `GET /agent/statistics` – aggregated risk distribution, common factors, actions, and department overview.

## Testing
The test suite `tests/test_agent.py` validates all endpoints using FastAPI's `AsyncClient`. It covers:
* Single recommendation schema validation.
* Batch processing with graceful error handling.
* Retrieval of history and statistics.

## Deployment Notes
* **Environment:** Ensure `GROQ_API_KEY` is present in `.env`.
* **Async Runtime:** All entry points are `async` to maintain non‑blocking behavior.
* **Scaling:** For large batches, replace the sequential loop in `generate_batch_recommendations` with `asyncio.gather`.

---
*Prepared by the RetentionAI Agentic AI team.*
