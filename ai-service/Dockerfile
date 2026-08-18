# RetentionAI — FastAPI AI Service (ML + SHAP + NLP + RAG + Decision Engine)
# Single-stage: the ML/NLP dependency tree (torch, transformers, chromadb,
# spacy) doesn't compress well across stages, so this optimizes for build
# cache reuse (requirements installed before app code is copied) rather than
# final image size.

FROM python:3.12-slim AS runtime
WORKDIR /app

# build-essential is required to compile scientific-Python C-extensions;
# libgomp1 required for LightGBM/XGBoost OpenMP runtime.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential curl libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    && python -m spacy download en_core_web_sm \
    && apt-get purge -y build-essential && apt-get autoremove -y

RUN addgroup --system retentionai && adduser --system --ingroup retentionai retentionai

ENV MPLCONFIGDIR=/tmp/matplotlib
ENV MODEL_ARTIFACT_PATH=/app/models/active
ENV CHROMA_PERSIST_DIRECTORY=/app/chroma_db

COPY app ./app
COPY train_model.py seed_ml_data.py ./
COPY models/active ./models/active
COPY chroma_db ./chroma_db

RUN mkdir -p /app/knowledge_base \
    && chown -R retentionai:retentionai /app
USER retentionai

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8000/health || exit 1

# Binds dynamically to Cloud Run's $PORT (defaults to 8000 for local/compose runs)
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
