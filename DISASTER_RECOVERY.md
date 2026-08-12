# RetentionAI Enterprise Disaster Recovery & Emergency Operations Runbook

## Overview
This runbook provides step-by-step emergency operating procedures for the RetentionAI Enterprise SaaS platform. It governs database restoration, vector index recovery, model artifact recovery, secret rotation, service recovery, and tenant isolation validation.

---

## 1. Incident Response Initial Protocol
1. **Declare Incident Level**:
   - **SEV-1 (Critical)**: Complete outage of MongoDB Atlas, FastAPI AI Service, or primary API backend.
   - **SEV-2 (High)**: Degraded performance, vector store unavailability, or partial Redis cache failure.
   - **SEV-3 (Moderate)**: Isolated non-critical UI error or telemetry ingestion delay.
2. **Assign Incident Commander & Lead Engineer**.
3. **Capture Initial Diagnostics**:
   - Check `GET /health` and `GET /ready`.
   - Record active `correlationId` from failure reports.
   - Run `node scripts/releaseValidation.js` to assess platform state.

---

## 2. MongoDB Atlas Backup & Restore Procedure
### Backup (Automated / Manual Snapshot)
MongoDB Atlas maintains continuous automated point-in-time backups. For manual pre-maintenance snapshot:
```bash
mongodump --uri="MONGODB_URI_HERE" --out=/backup/retentionai_$(date +%F_%H%M)
```

### Restore Procedure
To restore from a point-in-time snapshot or dump directory:
```bash
mongorestore --uri="MONGODB_URI_HERE" --drop /backup/retentionai_2026-08-12_1500
```
> **IMPORTANT**: After restoration, execute `node scripts/checkReferentialIntegrity.js` to confirm tenant referential integrity across all collections.

---

## 3. ChromaDB Vector Store Backup & Re-Indexing
- **Storage Location**: `ai-service/chroma_db/`
- **Backup**:
  ```bash
  tar -czvf /backup/chroma_db_$(date +%F).tar.gz ai-service/chroma_db
  ```
- **Restoration**:
  ```bash
  tar -xzvf /backup/chroma_db_YYYY-MM-DD.tar.gz -C ai-service/
  ```
- **Re-Indexing Procedures (If Vector Index Corrupted)**:
  If `hr_knowledge_base` vector index requires rebuilding from primary source policy documents:
  ```bash
  cd ai-service
  python app/rag/ingest.py
  ```
  Verify chunk count:
  ```bash
  python evals/rag_benchmark.py
  ```

---

## 4. Redis Cache Rebuild Procedure
If Redis cache is evicted, flushed, or unreachable:
1. RetentionAI operates in a **cache-aside pattern**. All core persistent data resides in MongoDB.
2. No data loss occurs on Redis eviction.
3. If Redis host changes, update `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in `server/.env`.
4. Restart Express backend server; cache warming occurs automatically on initial tenant requests.

---

## 5. CatBoost ML Model Artifact Recovery
- **Active Model Path**: `models/active/attrition_model.joblib`
- **Archive Path**: `models/archive/`
- **Recovery Procedure**:
  If the active model file becomes corrupted:
  ```bash
  cp models/archive/attrition_model_v1.joblib models/active/attrition_model.joblib
  ```
  Verify model loading via AI Service:
  ```bash
  cd ai-service
  python -c "import joblib; m = joblib.load('../models/active/attrition_model.joblib'); print('Model Loaded Successfully')"
  ```

---

## 6. Environment Secret & Password Rotation Protocol
If credentials (e.g. MongoDB password, JWT secrets, AI Service tokens) are rotated:
1. Update `server/.env` with updated values.
2. Verify `server/.env` remains git-ignored (`git check-ignore server/.env`).
3. Verify connection via safe ping without echoing credentials:
   ```bash
   node -e "require('dotenv').config({path:'server/.env'}); require('mongoose').connect(process.env.MONGODB_URI).then(() => console.log('Ping OK')).catch(e => console.error(e.message))"
   ```
4. Restart backend and AI services.

---

## 7. Step-by-Step Service Recovery Sequence
In the event of a total cluster cold-restart, recover services in exact numerical order:

```
Step 1: MongoDB Atlas / Database Layer
  ↓
Step 2: Python FastAPI AI Service (port 8000)
  ↓
Step 3: Node.js Express Backend API Server (port 5000)
  ↓
Step 4: React Frontend Production Static Server
```

Verification after full boot:
```bash
# Check Liveness
curl http://localhost:5000/health

# Check Readiness across all 4 subsystems
curl http://localhost:5000/ready
```

---

## 8. Tenant Isolation & Security Post-Restoration Checklist
After any disaster recovery or restoration event, run:
1. `node scripts/releaseValidation.js`
2. `node --env-file=.env --test tests/securityRegression.integration.test.js`
3. `python evals/eval_suite.py`

Confirm 100% pass status across IDOR protection, cross-tenant isolation, and RAG retrieval before opening traffic to production users.
