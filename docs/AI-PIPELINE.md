# AI Pipeline Documentation

Five stages, each building on the last, all served by `ai-service`
(FastAPI) and persisted by `server` (Express):

## 1. Prediction

- **Input:** an employee's HR record (tenure, compensation, performance,
  attendance, etc.)
- **Model:** LightGBM classifier, trained via `ai-service/train_model.py`,
  artifact stored at `models/active/attrition_model.joblib`.
- **Output:** `riskScore` (0-1), `riskLevel` (LOW/MEDIUM/HIGH), `confidence`.
- **Storage:** `Prediction` (upserted — latest only) +
  `PredictionHistory` (insert-per-generation, powers trend charts).
- **Endpoints:** `POST /api/v1/ai/predict/:id`, `POST /api/v1/ai/predict/batch`.

## 2. SHAP Explainability

- **Input:** the same feature vector used for prediction.
- **Method:** `TreeExplainer` over the LightGBM model (`app/explainability/shap_explainer.py`),
  initialized once at startup against a background dataset.
- **Output:** top positive/negative contributing factors, per-feature SHAP
  values, a plain-language narrative summary.
- **Storage:** `Explanation` (insert-per-generation).
- **Endpoints:** `GET`/`POST /api/v1/explain/:id`, `GET /api/v1/explain/global/feature-importance`.

## 3. Employee Intelligence (NLP)

- **Input:** free-text HR data — survey responses, feedback, manager notes.
- **Methods:** VADER + DistilBERT sentiment, a zero-shot emotion classifier,
  topic extraction (spaCy).
- **Output:** sentiment score, burnout indicator, dominant emotion, topic
  frequency.
- **Storage:** `EmployeeIntelligence` (insert-per-generation).
- **Endpoints:** `POST /api/v1/employee-intelligence/:id`, `.../dashboard/summary`.

## 4. Knowledge Intelligence (RAG)

- **Input:** uploaded HR policy documents (PDF/DOCX/TXT/MD).
- **Pipeline:** chunk → embed (`sentence-transformers/all-MiniLM-L6-v2`) →
  store in ChromaDB → retrieve top-K relevant chunks per query.
- **Output:** a natural-language answer to an HR policy question, with
  cited source documents.
- **Storage:** `KnowledgeDocument` (metadata) + ChromaDB (vectors, on disk
  at `CHROMA_PERSIST_DIRECTORY`).
- **Endpoints:** `POST /api/v1/knowledge/query`, `GET /api/v1/knowledge/search`.

## 5. Decision Intelligence

- **Input:** stages 1-4's outputs, combined.
- **Method:** an LLM (Groq, `llama-3.1-8b-instant` by default) reasons over
  the risk score, SHAP factors, NLP signals, and retrieved policy context to
  produce a structured recommendation (`app/agent/chains/reasoning_chain.py`).
- **Output:** `recommendationType`, `priority`, `confidence`, `reasoning`,
  `recommendedActions[]`, `expectedOutcome`.
- **Storage:** `Decision` (insert-per-generation, cached — regenerated only
  if the employee's record changed more recently than the cached decision,
  or `?refresh=true` is passed).
- **Endpoints:** `POST /api/v1/decisions/:employeeId/generate`, `PATCH /api/v1/decisions/status/:id`.

## What happens after a Decision

A `Decision` is a *recommendation*. Turning it into a real HR action is the
workflow layer's job, not the AI pipeline's:
`POST /api/v1/interventions/from-decision` creates an `Intervention` from an
existing `Decision`, which then runs through the approval chain →
assignment → completion lifecycle described in
[ARCHITECTURE.md](./ARCHITECTURE.md). The AI pipeline never mutates
workflow state directly — this is the deliberate FastAPI-computes/Express-persists boundary.

## Explicit non-goals (by design)

- The Executive Dashboard performs **zero** new AI computation — it's a
  pure rollup over the five stages above.
- No stage retrains or fine-tunes a model at request time — `train_model.py`
  is a separate, manually-triggered offline step.
