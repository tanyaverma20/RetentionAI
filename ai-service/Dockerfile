# RetentionAI — FastAPI AI Service (ML + SHAP + NLP + RAG + Decision Engine)
# Single-stage: the ML/NLP dependency tree (torch, transformers, chromadb,
# spacy) doesn't compress well across stages, so this optimizes for build
# cache reuse (requirements installed before app code is copied) rather than
# final image size.

# 3.12, not 3.11: shap 0.52.0 declares Requires-Python >=3.12 — a 3.11 base
# fails at `pip install -r requirements.txt` with "No matching distribution
# found for shap==0.52.0". This image has never built successfully with the
# 3.11 base (confirmed via `pip show shap` → Requires-Python: >=3.12). Same
# fix already applied to the lite build's Dockerfile at the repo root.
FROM python:3.12-slim AS runtime
WORKDIR /app

# build-essential is required to compile a handful of scientific-Python
# C-extensions on some platforms; removed after pip install to keep the
# final layer smaller.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    && python -m spacy download en_core_web_sm \
    && apt-get purge -y build-essential && apt-get autoremove -y

RUN addgroup --system retentionai && adduser --system --ingroup retentionai retentionai

COPY app ./app
COPY train_model.py seed_ml_data.py ./
RUN mkdir -p /app/chroma_db /app/knowledge_base /app/models/active \
    && chown -R retentionai:retentionai /app
USER retentionai

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8000/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
