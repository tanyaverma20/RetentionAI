# RetentionAI — FastAPI AI Service, tuned for Hugging Face Spaces (Docker SDK).
#
# Kept separate from ai-service/Dockerfile (which Render and docker-compose
# build) because Spaces imposes three constraints that image does not meet:
#
#   1. Ephemeral disk. A free Space has no persistent volume, so anything
#      downloaded at runtime is re-downloaded on every restart. The Render
#      image relies on a mounted disk plus a warm HF cache; here the model
#      weights must be baked into the image itself.
#   2. Offline by default. app/main.py sets HF_HUB_OFFLINE/TRANSFORMERS_OFFLINE
#      when AI_MODELS_OFFLINE is unset or true, so a model that is not already
#      on disk cannot be fetched — the NLP and RAG paths would fail at first
#      use rather than at boot. Pre-downloading below is what makes that flag
#      safe to leave on.
#   3. The container runs as UID 1000, and every path the app writes to
#      (HF cache, chroma_db, models) must be owned by that user.

FROM python:3.11-slim AS runtime

# Spaces runs the image as UID 1000; create that user up front so every
# COPY --chown and cache path below lands on the right owner.
RUN useradd --create-home --uid 1000 user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH \
    HF_HOME=/home/user/.cache/huggingface \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential curl \
    && rm -rf /var/lib/apt/lists/*

COPY --chown=user requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    && python -m spacy download en_core_web_sm \
    && apt-get purge -y build-essential && apt-get autoremove -y

USER user

# Bake in every model the service loads lazily at runtime. These are the exact
# identifiers hardcoded in app/nlp/analyzer.py and
# app/rag/embeddings/embedding_manager.py — if either changes, this list must
# change with it or the Space will boot fine and then fail on the first NLP or
# knowledge-search request, which is a much harder failure to trace.
RUN python -c "\
from transformers import pipeline; \
pipeline('text-classification', model='SamLowe/roberta-base-go_emotions', top_k=None); \
pipeline('zero-shot-classification', model='valhalla/distilbart-mnli-12-3')" \
    && python -c "\
from sentence_transformers import SentenceTransformer; \
SentenceTransformer('all-MiniLM-L6-v2')"

COPY --chown=user app ./app
COPY --chown=user train_model.py seed_ml_data.py ./
# models/active carries the trained attrition bundle. prediction_service.py
# reads MODEL_ARTIFACT_PATH and falls back to the newest *.joblib in it; with
# no artifact present the service still starts but every prediction fails, so
# the bundle is shipped in the image rather than trained on boot (training
# needs the dataset, which is not part of this image).
COPY --chown=user models/active ./models/active
RUN mkdir -p /app/chroma_db /app/knowledge_base

# Spaces routes to the port declared as `app_port` in README.md's frontmatter.
# Keep the two in sync; 7860 is the Spaces default.
ENV AI_SERVICE_PORT=7860
EXPOSE 7860

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD curl -fsS http://127.0.0.1:7860/health || exit 1

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${AI_SERVICE_PORT:-7860}"]
