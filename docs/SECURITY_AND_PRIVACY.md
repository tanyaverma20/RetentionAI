# RetentionAI — Security, Privacy, and Responsible AI Governance

**Document Version:** 1.0.0  
**Effective Date:** October 2026  
**Target Architecture:** Multi-Tenant Retention Analytics & Decision SaaS (FastAPI + Express + React + MongoDB)

---

## 1. Authentication, Authorization & Access Control

### 1.1 Dual-Token Authentication Lifecycle
- **Access Tokens:** Signed via HMAC-SHA256 with `JWT_ACCESS_SECRET`. Short-lived (15 minutes default) to minimize exposure windows.
- **Refresh Tokens:** Signed via `JWT_REFRESH_SECRET`. Stored in HTTP-only, secure, SameSite cookies with a 7-day TTL (`JWT_REFRESH_TTL`).
- **Revocation & Rotation:** Refresh tokens are rotated upon use; previous tokens are invalidated in the database to prevent replay attacks.
- **Service-to-Service Token:** FastAPI AI service endpoints require an authenticated internal bearer token (`AI_SERVICE_TOKEN`), preventing unauthorized internal or external network calls.

### 1.2 Role-Based Access Control (RBAC)
RetentionAI implements an 8-tier hierarchical RBAC matrix defined in `server/src/config/roles.js`:

| Role | Scope & Permissions | Permitted Actions |
|---|---|---|
| **ADMIN** | System-wide administrative operations | Tenant settings, user provisioning, global audit logs |
| **CHRO / CEO** | Executive organizational visibility | High-level turnover analytics, workforce trajectory, macro trends |
| **HR_DIRECTOR** | Departmental & strategic governance | Retention budget allocation, intervention sign-off, global reviews |
| **HR_MANAGER** | Team-level operational intervention | Employee profiles, intervention queue, survey assignments |
| **HR_ANALYST** | Read-only analytical evaluation | Model metrics, drift reports, A/B test statistical reviews |
| **DEPARTMENT_MANAGER** | Direct report oversight | Direct team risk assessments, sentiment notes, performance reviews |
| **EMPLOYEE** | Individual self-service | Personal surveys, feedback submissions, individual task lists |

### 1.3 Strict Multi-Tenant Isolation
- **Tenant Key:** Every MongoDB collection enforces `organizationId` scoping.
- **Query Boundary:** Middleware (`server/src/middleware/tenantIsolation.js`) injects the authenticated user's `req.user.organizationId` into all database operations. Cross-tenant leakage is prevented at the gateway layer.
- **Model Metadata & Registry:** Model versions, experiment runs, and metrics are isolated per tenant or strictly marked system-wide.

---

## 2. Privacy Engineering & Data Protection

### 2.1 Keyed HMAC Pseudonymization (Anti-Reversal Standard)
Treating simple SHA-256 or static-salted hashes as "anonymized" is a known vulnerability: an attacker with an employee roster can precompute SHA-256 hashes for known employee IDs (e.g., `EMP0001`, `EMP0002`) and de-anonymize logs via dictionary or rainbow-table attacks.

RetentionAI eliminates this vulnerability by employing **Keyed HMAC-SHA256 Pseudonymization** in `ai-service/app/prediction/inference_logger.py`:
$$\text{PseudonymousID} = \text{HMAC-SHA256}(\text{Key} = \text{HMAC\_TELEMETRY\_SECRET}, \text{Message} = \text{EmployeeID})[:16]$$
- **Cryptographic Independence:** Even if an attacker knows the raw employee ID, they cannot determine the pseudonymous identifier without the cluster's private secret key.
- **Organization-Scoped Keys:** Organizations can configure distinct HMAC keys, ensuring zero cross-tenant correlation.

### 2.2 Strict PII Exclusion from Inference Logs
Operational telemetry logs (`InferenceTelemetryLogger`) strictly prohibit recording Personally Identifiable Information:
- **Excluded Fields:** Employee names, email addresses, phone numbers, raw salaries, home addresses, access tokens, and passwords.
- **Recorded Operational Fields:** Request correlation ID (`correlationId`), model version, inference latency (ms), preprocessing latency (ms), predicted probability, discrete risk level, and keyed pseudonymous ID.
- **Exception Sanitization:** Exception strings are scrubbed via `sanitize_error_message()` to strip email addresses, database connection strings, file paths, and internal hostnames before logging.

---

## 3. Model Provenance & Artifact Security

### 3.1 Protection Against Deserialization Attacks
Python serialization libraries (`pickle`, `joblib`) can execute arbitrary bytecode if unverified files are deserialized. RetentionAI enforces a multi-layer defense in `ai-service/app/registry/model_registry.py`:
1. **Cryptographic Manifest Verification:** Every model artifact (`attrition_model.joblib`) must be accompanied by an adjacent `manifest.json` containing a SHA-256 digest (`sha256Checksum`) computed at packaging time.
2. **Pre-Deserialization Integrity Check:** `safe_load_model_bundle()` computes the file's SHA-256 hash in 64KB chunks and verifies it against the manifest *before* loading the object. Any mismatch raises a `ModelIntegrityException` immediately.
3. **Strict Production Enforcement:** In production mode (`REQUIRE_MANIFEST_CHECKSUM=true`), artifacts without signed manifests are rejected outright.
4. **Interface Validation:** Deserialized objects must strictly match `REQUIRED_BUNDLE_KEYS` and verify that the estimator implements expected `.predict()` and `.predict_proba()` contracts.

### 3.2 Atomic Promotion & Automated Rollback
Model promotion follows an atomic gate:
1. Candidate models are packaged into an isolated `_staging` directory.
2. The candidate is validated against `evaluate_promotion_gate()`.
3. If approved, the active champion is copied to `_backup_champion`.
4. The candidate is promoted to `models/active/`.
5. If the runtime service fails to initialize or deserialize the new model, it automatically rolls back to `_backup_champion`, preserving the verified active model without service downtime.

---

## 4. Responsible AI & Ethical Human Oversight

### 4.1 Prohibition of Automated Adverse Employment Actions
- **Advisory Role Only:** RetentionAI predictions and decision recommendations are decision-support tools designed to identify retention risks and suggest supportive interventions (e.g., mentorship, stay interviews, compensation reviews).
- **Prohibited Use:** RetentionAI models must **never** be used as the sole basis for adverse employment decisions (e.g., termination, disciplinary action, demotion, or compensation reduction).
- **Human-in-the-Loop:** All interventions require explicit review and authorization by an authenticated HR Manager or HR Director.

### 4.2 Causal Boundary Disclaimers
Machine learning models identify statistical correlations, not direct causal relationships. RetentionAI enforces prominent causal disclaimers in all SHAP explanation responses:
> *"Statistical Association Notice: Feature importance and SHAP contribution scores reflect statistical associations learned from historical training distributions. They do not constitute verified causal mechanisms. Management decisions should consider holistic context and human judgment."*

### 4.3 Demographic Parity & Fairness Monitoring
The experimentation and evaluation module (`ai-service/app/experimentation/`) computes demographic parity ratios and selection rate equity across protected attributes (e.g., Department, Gender, Tenure bands) to prevent disparate impact in employee retention intervention queues.
