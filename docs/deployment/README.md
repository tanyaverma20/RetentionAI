# RetentionAI — Deployment Guides

RetentionAI is four deployable units:

| Service | Technology | Port | Depends on |
|---|---|---|---|
| `client` | React (Vite) → static files behind nginx | 80 | `server` |
| `server` | Node.js / Express | 5000 | `mongo`, `ai-service` |
| `ai-service` | Python / FastAPI | 8000 | `mongo` |
| `mongo` | MongoDB 7 | 27017 | — |

The root [`docker-compose.yml`](../../docker-compose.yml) builds and wires all
four together with health-check-gated startup ordering — every guide below
either uses that file directly (Docker-based hosts) or replicates the same
four services on managed platform equivalents.

Pick a guide:

- [Render](./render.md) — simplest managed option, good for a demo/staging deployment.
- [Railway](./railway.md) — similar to Render, Docker-native.
- [Docker VPS](./docker-vps.md) — any plain Linux VPS (Hetzner, Linode, OVH, a bare EC2/Droplet instance) — this is the reference deployment; every other guide is a variation of it.
- [DigitalOcean App Platform](./digitalocean.md) — managed, Docker-native, minimal ops.
- [AWS EC2](./aws-ec2.md) — self-managed VM, full control.
- [Azure](./azure.md) — Azure Container Apps + Cosmos DB (Mongo API) or Azure VM.

## Before deploying anywhere

1. Copy every `production.env.example` (root, `server/`, `ai-service/`, `client/`) to `.env` and fill in real values.
2. Generate real secrets — never reuse the example placeholders:
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```
3. Decide where MongoDB actually lives: a managed Atlas cluster is strongly
   recommended over self-hosting `mongo` in production (`docker-compose.prod.yml`
   already stops publishing Mongo's port, but you still own backups/HA if you
   self-host it — see [Part 7 backup/restore scripts](../../scripts/ops/)).
4. Point `MODEL_ARTIFACT_PATH`/`CHROMA_PERSIST_DIRECTORY` at persistent
   volumes — losing these means retraining the model and re-ingesting the
   knowledge base.
