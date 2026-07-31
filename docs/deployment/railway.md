# Deploying to Railway

Railway builds from Dockerfiles like Render, with a nicer built-in
project-level environment variable UI and a managed Redis/Postgres
marketplace (no managed Mongo — use Atlas, same as Render).

## 1. Create a project, add MongoDB Atlas

Railway has no native MongoDB plugin — provision an Atlas cluster (free M0
tier is fine for evaluation) and grab its connection string.

## 2. Add three services from the same repo

Railway supports multiple services per project, each pointed at a different
subdirectory:

| Service | Root directory | Builder |
|---|---|---|
| `ai-service` | `ai-service/` | Dockerfile (auto-detected) |
| `server` | `server/` | Dockerfile (auto-detected) |
| `client` | `client/` | Dockerfile (auto-detected) |

For each: Settings → Root Directory → set the path above. Railway rebuilds
from that service's `Dockerfile` on every push.

## 3. Environment variables

Set per-service (Railway's Variables tab), same keys as
`*/production.env.example`. Use Railway's private networking to reference
services: e.g. `server`'s `AI_SERVICE_URL` = `http://ai-service.railway.internal:8000`,
and `client`'s build-time `VITE_API_BASE_URL` = the `server` service's public
Railway domain + `/api/v1`.

## 4. Volumes

Attach a Railway Volume to `ai-service` at `/app/models/active` and
`/app/chroma_db`, and to `server` at `/app/uploads` — without these, every
redeploy wipes the trained model, vector store, and uploaded files.

## 5. Health checks

Railway's health check field: set `/health` for both `server` and
`ai-service` (Settings → Health Check Path). Startup can take ~30s for
`ai-service` (model + NLP + ChromaDB warm-up) — set the health check's grace
period accordingly.

## 6. Deploy

Push to the connected branch — Railway builds and deploys all three services
automatically. Watch the deploy logs for each; `ai-service` is the slowest.
