# Deploying to Azure

Two viable paths depending on how much you want managed vs. self-run.

## Option A — Azure Container Apps (managed, recommended)

1. **Database:** Azure Cosmos DB for MongoDB (vCore or RU-based API) — either
   works with this app's driver (Mongoose/Motor speak standard MongoDB wire
   protocol). Get the connection string from Cosmos DB's "Connection String" blade.
2. **Container Registry:** push each service's image to Azure Container
   Registry:
   ```bash
   az acr build --registry <your-acr> --image retentionai/server:latest ./server
   az acr build --registry <your-acr> --image retentionai/ai-service:latest ./ai-service
   az acr build --registry <your-acr> --image retentionai/client:latest ./client --build-arg VITE_API_BASE_URL=https://<server-app-fqdn>/api/v1
   ```
3. **Container Apps Environment:** create one environment, then three
   Container Apps (`ai-service`, `server`, `client`) pointing at the images
   above. Container Apps' internal ingress gives each app a
   `<name>.internal.<env-domain>` address for service-to-service calls
   (`server`'s `AI_SERVICE_URL`).
4. **Storage:** mount an Azure Files share into `ai-service` at
   `/app/models/active` and `/app/chroma_db` (Container Apps supports Azure
   Files volume mounts), and into `server` at `/app/uploads`.
5. **Secrets:** set `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`,
   `AI_SERVICE_TOKEN`, `GROQ_API_KEY` as Container Apps secrets, referenced
   by the corresponding environment variables — never as plain env vars.
6. **Scaling:** Container Apps' HTTP-based autoscaling works for `server`
   and `client`; keep `ai-service` at a fixed minimum of 1 replica (cold
   start is ~20-30s — scale-to-zero would push that latency onto real users).

## Option B — Azure VM (self-managed, same as any Docker VPS)

Follow [docker-vps.md](./docker-vps.md) verbatim on an Azure `Standard_B2ms`
(2 vCPU / 8GB) or larger VM. Use an Azure Network Security Group instead of
UFW/iptables for the inbound-port restrictions (80/443/22 only).

## Notes

- Azure Cosmos DB's MongoDB API has some behavioral differences from real
  MongoDB (notably around aggregation pipeline operator support and index
  limits) — run [`scripts/check-consistency.js`](../../server/scripts/check-consistency.js)
  after the first data load to confirm nothing silently failed, and smoke-test
  the Executive Dashboard's aggregation-heavy endpoints specifically.
