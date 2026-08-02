# RetentionAI — AI Service, LITE build.
#
# Read this before assuming a root Dockerfile builds the whole project: it
# does not. Each service owns its image (server/Dockerfile,
# client/Dockerfile, ai-service/Dockerfile). This file builds only the AI
# service, and it sits at the repository root for two converging reasons:
#
#   1. It needs a repo-root build context. The trained model bundle lives in
#      models/active/, outside ai-service/, and a free-plan service gets no
#      persistent disk to hold it — so the bundle has to be baked into the
#      image, which means COPYing from above ai-service/.
#   2. Render's CLI cannot set a service's Dockerfile path (neither
#      `services create` nor `services update` exposes it; only `--image`),
#      so a CLI-created service looks for ./Dockerfile at the context root.
#      Putting the file anywhere else would require a manual dashboard edit
#      on every rebuild of the service.
#
# Same application code as the full image, built against requirements-lite.txt
# so it fits a 512 MB container: ~265 MB of imports versus ~496 MB for the
# full stack, before any model weights load. app/features.py detects the
# absent libraries and serves 503 on the NLP and RAG routes; prediction, SHAP
# explainability and decision recommendations are unaffected.
#
# Build locally with:  docker build -f Dockerfile .

# 3.12, not 3.11: shap 0.52.0 declares Requires-Python >=3.12, so a 3.11 base
# fails at pip-install time with "No matching distribution". (ai-service/
# Dockerfile still pins 3.11 against the same shap version and has the same
# latent failure — it has never been built successfully.)
FROM python:3.12-slim AS runtime
WORKDIR /app

# No build-essential here: every wheel in requirements-lite.txt ships prebuilt
# for linux/amd64, and compiling from source is the single largest contributor
# to build time on a free plan.
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY ai-service/requirements-lite.txt .
RUN pip install --no-cache-dir -r requirements-lite.txt

RUN addgroup --system retentionai && adduser --system --ingroup retentionai retentionai

COPY ai-service/app ./app
COPY ai-service/train_model.py ai-service/seed_ml_data.py ./
# The trained attrition bundle. prediction_service.py reads
# MODEL_ARTIFACT_PATH and falls back to the newest *.joblib in it; without an
# artifact the service starts but every prediction fails. Committed to the
# repo (see the negation in .gitignore) precisely so this COPY works on
# Render, which builds from git and gives a free service no persistent disk.
COPY models/active ./models/active
RUN mkdir -p /app/chroma_db /app/knowledge_base /app/models/active \
    && chown -R retentionai:retentionai /app
USER retentionai

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8000/health || exit 1

# Render injects PORT; fall back to 8000 for local runs and compose.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
