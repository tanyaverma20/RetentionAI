#!/usr/bin/env bash
#
# Assemble and push the AI service to a Hugging Face Space.
#
# A Space is its own git repo whose root must hold the Dockerfile and a
# README.md carrying the Spaces frontmatter. The service source lives in
# ai-service/ and is shared with the Render/compose deployment, so rather than
# reshuffling the repo this script stages a Space-shaped copy in a temp dir and
# pushes that. Nothing under ai-service/ is modified.
#
# Usage:
#   ./deploy/huggingface/push-space.sh <hf-username>/<space-name>
#
# Prerequisites:
#   - `hf auth login` completed (a *write* token).
#   - models/active/attrition_model.joblib present locally — it is gitignored
#     in this repo, and without it the Space starts but every prediction fails.

set -euo pipefail

SPACE_ID="${1:-}"
if [[ -z "$SPACE_ID" ]]; then
  echo "usage: $0 <hf-username>/<space-name>" >&2
  exit 2
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HF_DIR="$REPO_ROOT/deploy/huggingface"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

MODEL_ARTIFACT="$REPO_ROOT/models/active/attrition_model.joblib"
if [[ ! -f "$MODEL_ARTIFACT" ]]; then
  echo "error: $MODEL_ARTIFACT not found." >&2
  echo "Train it first (see ai-service/train_model.py) — the Space ships the" >&2
  echo "bundle in its image because a free Space has no persistent disk." >&2
  exit 1
fi

echo "==> Staging Space contents in $STAGE"
# Source, minus local caches and secrets. --exclude order matters: .env is
# dropped but .env.example is kept as documentation.
tar -C "$REPO_ROOT/ai-service" -cf - \
  --exclude='.env' \
  --exclude='__pycache__' \
  --exclude='.pytest_cache' \
  --exclude='.ruff_cache' \
  --exclude='chroma_db' \
  --exclude='catboost_info' \
  --exclude='*.log' \
  --exclude='*.joblib' \
  . | tar -C "$STAGE" -xf -

mkdir -p "$STAGE/models/active"
cp "$MODEL_ARTIFACT" "$STAGE/models/active/"

# The Space-specific Dockerfile and frontmatter README win over anything the
# source tree happens to carry.
cp "$HF_DIR/Dockerfile" "$STAGE/Dockerfile"
cp "$HF_DIR/README.md" "$STAGE/README.md"

echo "==> Verifying no secrets are staged"
if find "$STAGE" -name '.env' -o -name '*.pem' -o -name '*.key' | grep -q .; then
  echo "error: refusing to push — secret-looking files found in staging dir:" >&2
  find "$STAGE" -name '.env' -o -name '*.pem' -o -name '*.key' >&2
  exit 1
fi

echo "==> Pushing to https://huggingface.co/spaces/$SPACE_ID"
hf upload "$SPACE_ID" "$STAGE" . --repo-type=space --commit-message="Deploy RetentionAI AI service"

cat <<EOF

Done. Next:
  1. Space settings -> Variables and secrets, add:
       AI_SERVICE_ENV=production
       AI_SERVICE_TOKEN   (must equal the Express API's value)
       GROQ_API_KEY
       MONGODB_URI
       MONGODB_DB_NAME=retentionai
  2. Wait for the build (first one is slow — model weights are baked in).
  3. Verify:  curl https://<user>-<space>.hf.space/health
  4. Point the API at it: set AI_SERVICE_URL on the Render service to that
     base URL, which triggers a restart.
EOF
