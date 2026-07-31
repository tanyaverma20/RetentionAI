# Deploying to Render

Render builds directly from each service's `Dockerfile`, so this maps almost
1:1 onto the four services already defined in `docker-compose.yml`.

## 1. MongoDB

Render doesn't offer managed MongoDB — use **MongoDB Atlas** (free M0 tier is
enough for a demo). Create a cluster, a database user, and allow-list
Render's outbound IPs (or `0.0.0.0/0` for simplicity on a demo deployment).
Copy the connection string for `MONGODB_URI`.

## 2. AI Service (Web Service)

- New → Web Service → connect the repo, root directory `ai-service/`.
- Render detects the `Dockerfile` automatically. If not, set:
  - Build command: *(leave blank — Dockerfile handles it)*
  - Start command: *(leave blank — Dockerfile's CMD handles it)*
- Environment: copy every key from `ai-service/production.env.example`, using your Atlas URI for `MONGODB_URI`.
- Add a **persistent disk** mounted at `/app/chroma_db` (1GB+) and another at `/app/models/active` — otherwise the vector store and trained model are wiped on every redeploy.
- Health check path: `/health`.

## 3. Express Server (Web Service)

- New → Web Service, root directory `server/`.
- Environment: copy from `server/production.env.example`. Set `AI_SERVICE_URL` to the AI service's Render-assigned internal or public URL.
- Add a persistent disk at `/app/uploads` for attachments/reports.
- Health check path: `/health`.

## 4. Client (Static Site)

- New → Static Site, root directory `client/`.
- Build command: `npm ci && npm run build`
- Publish directory: `dist`
- Environment: `VITE_API_BASE_URL=https://<your-server-service>.onrender.com/api/v1` (Vite bakes this in at build time — set it *before* the first build).
- Add a rewrite rule `/*` → `/index.html` (SPA fallback — Render's static-site rewrites panel, equivalent to `client/nginx.conf`'s `try_files`).

## 5. Wire CORS

Set `server`'s `CORS_ORIGINS` to the static site's `https://<name>.onrender.com` URL (or your custom domain once attached).

## Notes

- Render free-tier web services spin down after inactivity — the AI
  service's ~20-30s cold start (loading the ML model + NLP models +
  ChromaDB) will show up as a slow first request after idle. Use a paid
  instance type for production, or a scheduled health-check ping to keep it warm.
- Render's automatic HTTPS + custom domains cover TLS — no separate reverse proxy needed.
