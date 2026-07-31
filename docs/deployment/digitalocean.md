# Deploying to DigitalOcean App Platform

App Platform is Docker-native and closely mirrors the Render/Railway flow —
this guide covers only what's different.

## 1. Managed MongoDB

DigitalOcean does offer a **Managed MongoDB Database** product — use it
instead of Atlas if you want everything under one billing account. Create it
in the same region as your App Platform app to avoid cross-region latency;
copy its connection string for `MONGODB_URI`.

## 2. Create the App

- Apps → Create App → connect the repo.
- App Platform detects each service via `Dockerfile`; add three components:
  - **Web Service** `ai-service` — source directory `/ai-service`, HTTP port `8000`, health check path `/health`.
  - **Web Service** `server` — source directory `/server`, HTTP port `5000`, health check path `/health`.
  - **Static Site** `client` — source directory `/client`, build command `npm run build`, output directory `dist`.

## 3. Environment variables

Set per component under each component's "Environment Variables" tab, same
keys as `*/production.env.example`. Reference the managed database's
connection string via App Platform's "bindable" variable if you attach the
database as a resource, or paste it directly.

## 4. Persistent storage

App Platform's web services are stateless/ephemeral by default — there is no
Railway/Render-style attachable volume. For `ai-service`'s model artifacts
and ChromaDB, either:
- Bake the trained model into the Docker image at build time (rebuild to
  update it), or
- Point `MODEL_ARTIFACT_PATH`/`CHROMA_PERSIST_DIRECTORY` at a DigitalOcean
  Spaces bucket via an S3-compatible mount (requires custom startup script —
  not built into the base Dockerfile here), or
- Use a DigitalOcean Droplet + Docker Compose instead (see
  [docker-vps.md](./docker-vps.md)) if persistent local disk is important
  and you don't want to manage external object storage.

## 5. CORS + internal networking

App Platform gives each component an internal `<component>.internal` DNS
name — set `server`'s `AI_SERVICE_URL` to `http://ai-service:8000` (App
Platform's internal port convention) and `client`'s `VITE_API_BASE_URL` to
the `server` component's public app URL + `/api/v1`.
