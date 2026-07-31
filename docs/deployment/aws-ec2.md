# Deploying to AWS EC2

This is [docker-vps.md](./docker-vps.md) run on an EC2 instance, plus the
AWS-specific networking/security-group setup.

## 1. Launch the instance

- Instance type: `t3.large` (2 vCPU / 8GB) minimum — the AI service's
  ML/NLP/embedding stack is memory-hungry at cold start.
- AMI: Ubuntu 22.04 LTS.
- Storage: 30GB+ gp3 (model artifacts + ChromaDB + Docker images add up).
- Security Group: inbound 22 (SSH, restrict to your IP), 80/443 (public).
  **Do not** open 5000, 8000, or 27017 to `0.0.0.0/0`.

## 2. MongoDB

Either:
- **MongoDB Atlas**, with the Atlas cluster's Network Access list scoped to
  this EC2 instance's Elastic IP (recommended — no self-managed HA/backups).
- **Amazon DocumentDB** (MongoDB-compatible) if you want to stay fully
  in-VPC — note DocumentDB requires TLS by default; add
  `&tls=true&tlsCAFile=...` to `MONGODB_URI` per AWS's connection docs.
- Self-hosted `mongo` container from `docker-compose.yml`, backed by an
  attached EBS volume for the `mongo_data` volume's underlying storage.

## 3. Install Docker and deploy

Follow [docker-vps.md](./docker-vps.md) steps 2-6 verbatim — the Docker
install script and compose commands are identical on EC2.

## 4. TLS

Either:
- Put an **Application Load Balancer** in front with an ACM certificate
  (standard AWS pattern — ALB terminates TLS, forwards HTTP to the
  instance's port 80), or
- Run Caddy/nginx + Let's Encrypt directly on the instance, same as the
  generic VPS guide.

## 5. Elastic IP + DNS

Associate an Elastic IP so the instance's address survives a reboot; point
your domain's A record (or the ALB's DNS name via a CNAME/ALIAS) at it.

## 6. Backups

`scripts/ops/backup.sh` works unchanged on EC2. For automation, add a cron
job and optionally sync the output to an S3 bucket:
```bash
0 3 * * * /home/ubuntu/retentionai/scripts/ops/backup.sh && aws s3 cp /home/ubuntu/retentionai/backups/ s3://your-bucket/retentionai-backups/ --recursive
```
