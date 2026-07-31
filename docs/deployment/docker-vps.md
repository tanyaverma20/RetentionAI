# Deploying to a Docker VPS (Hetzner, Linode, OVH, DigitalOcean Droplet, bare EC2, ...)

This is the reference deployment — every managed-platform guide in this
folder is a variation of these same steps. Any VPS with 4GB+ RAM (the
NLP/embedding models are memory-hungry) and Docker installed works.

## 1. Provision the VPS

- Ubuntu 22.04+ LTS, 4 vCPU / 8GB RAM minimum (the AI service alone wants ~2-4GB).
- Open inbound ports 80/443 (and 22 for SSH). Do **not** expose 5000, 8000, or 27017 publicly — nginx on port 80/443 is the only public entry point.

## 2. Install Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# log out/in, then:
docker compose version
```

## 3. Clone and configure

```bash
git clone <your-repo-url> retentionai && cd retentionai
cp .env.example .env
cp server/production.env.example server/.env      # only needed if NOT using docker-compose's env passthrough
cp ai-service/production.env.example ai-service/.env
# Edit .env: set real JWT secrets, AI_SERVICE_TOKEN, GROQ_API_KEY, and
# CORS_ORIGINS to your actual domain (e.g. https://app.yourdomain.com).
```

## 4. Point at a real MongoDB

Either:
- **Managed (recommended):** create a free/small MongoDB Atlas cluster, set `MONGODB_URI` in `.env` to its connection string, and remove the `mongo` service from `docker-compose.prod.yml` (or just don't start it: `docker compose up -d ai-service server client`).
- **Self-hosted:** keep the bundled `mongo` service — it already persists to the `mongo_data` named volume — and run [`scripts/ops/backup.sh`](../../scripts/ops/backup.sh) on a cron schedule.

## 5. Build and start

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
docker compose ps          # all four should show "healthy"
docker compose logs -f server ai-service
```

The startup order is enforced by the compose file's `depends_on: condition: service_healthy` — `server` won't start until `mongo` and `ai-service` both pass their health checks, and `client` won't start until `server` does.

## 6. Put nginx/TLS in front

The `client` container already runs its own nginx on port 80 for static
assets + SPA routing, but it does not proxy `/api` — point a host-level
reverse proxy (or swap the client's `nginx.conf` for one that also proxies
`/api/v1` to the `server` container) and terminate TLS there. Simplest path:
run [Caddy](https://caddyserver.com/) or nginx + certbot on the host,
proxying:
- `/` → `client:80`
- `/api/v1` → `server:5000`

## 7. Verify

```bash
curl https://app.yourdomain.com/health              # server root health (behind your proxy path mapping)
curl https://app.yourdomain.com/api/v1/analytics/dashboard-summary -H "Authorization: Bearer <token>"
```

## Updating

```bash
git pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Rolling restarts aren't built in for a single-VPS deployment — expect a few
seconds of downtime per service during `--build`. For zero-downtime, put two
VPS behind a load balancer or move to Part 10's managed-platform guides.
