# Security Audit Report (Sprint 10, Part 6)

Scope: review of the entire application's security posture, with fixes
applied where gaps were found. No new attack surface was added beyond what
Sprint 10 itself introduces (Swagger UI, health endpoints), both reviewed below.

## Findings and fixes

| Area | Status | Detail |
|---|---|---|
| CORS `methods` missing `PUT` | **Fixed** | Silently broke `/api/v1/hr/:collection/:id` updates for cross-origin browsers only — same-origin/curl testing never surfaces a CORS preflight rejection. Added `PUT` to the allowed methods list. |
| Swagger UI CSP | **Fixed** | Helmet's default CSP blocks Swagger UI's inline `<style>`/`<script>` — page returned 200 but rendered blank. Scoped a relaxed CSP (`contentSecurityPolicy: false`) to `/api-docs` only; every other route keeps the strict default. |
| Environment secrets | **Hardened** | `server/src/config/env.js` now rejects placeholder JWT/AI-service-token values and matching access/refresh secrets when `NODE_ENV=production`. `ai-service/app/config.py` (new) validates `AI_SERVICE_TOKEN` presence in all environments and `GROQ_API_KEY` presence in production, failing startup with a clear message rather than booting broken. |
| NoSQL injection | **Already covered** | `sanitizeInput.js` recursively rejects any request body/query/params key containing `$` or `.`, applied globally before any route handler. |
| Rate limiting | **Already covered** | Per-endpoint limits on login (5/min, IP+email keyed), refresh, password reset/change — reviewed, all correctly wired in `authRoutes.js`. |
| JWT / refresh rotation | **Already covered, verified** | Access tokens are short-lived (15m default); refresh tokens rotate on every use (`issueSession` revokes the presented token and issues a new one, with `replacedByTokenHash` for replay detection). |
| CSRF | **N/A by design** | Confirmed zero cookie-based auth anywhere in the codebase (`grep` for `document.cookie`/`res.cookie`/`withCredentials` returned nothing) — auth is 100% `Authorization: Bearer` header, which a malicious cross-origin page cannot forge without already being able to read the token (blocked by browser same-origin policy). A CSRF token would defend a threat model this app doesn't have. |
| File upload hardening | **Already covered** (Sprint 9) | MIME-type + extension allowlists, size limits, and server-generated filenames (never client-supplied) for profile pictures, knowledge documents, and workflow attachments. |
| RBAC | **Verified** | Spot-checked EMPLOYEE-role denial across all Sprint 9 workflow write/admin endpoints (interventions, tasks, workflow dashboard, audit, automation) — all correctly 403, while notifications/comments (intentionally EMPLOYEE-accessible) remain 200. |
| Audit trail | **Already covered, extended** | Every login/logout, RBAC denial (new in Sprint 10), AI-pipeline call, workflow event, comment, approval decision, and export is recorded in `AuditLog`. |
| Sensitive data in logs | **Verified clean** | Every new Sprint 10 structured-log call site was reviewed — none logs passwords, tokens, or full request bodies; auth failure logs record only email + failure reason. |
| Dependency vulnerabilities | **Documented, not force-fixed** | `npm audit` reports 10 vulnerabilities (9 high, 1 critical) in `server`, all in **dev-time tooling's transitive dependencies** (eslint's `minimatch`/`glob` chain, and `bcrypt`'s native-binary installer via `node-pre-gyp`→`tar`) — none reachable from the running application's request path. The only fix path (`npm audit fix --force`) forces a major `bcrypt` bump (5→6), which risks breaking the native password-hashing binary; deferred as tech debt rather than force-upgraded without dedicated testing. |

## Security headers (current, verified live)

```
Content-Security-Policy: default-src 'self'; ...; script-src 'self'; style-src 'self' https: 'unsafe-inline'; ...
X-Content-Type-Options: nosniff
X-Frame-Options: (via helmet defaults)
Strict-Transport-Security: (via helmet defaults, effective once served over HTTPS)
```

## Recommendations for production (not yet implemented — flagged for the deploying team)

- Terminate TLS at a reverse proxy/load balancer (nginx/Caddy/ALB) — this
  app assumes HTTPS is provided by the deployment layer, not itself.
- Rotate the seeded demo accounts' passwords or delete them entirely before
  any real deployment (see [ADMIN-MANUAL.md](./ADMIN-MANUAL.md)).
- Schedule `npm audit`/`pip-audit` in CI to catch new advisories, and
  revisit the deferred `bcrypt` major-version upgrade with a dedicated test pass.
