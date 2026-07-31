# Developer Guide

## Conventions this codebase follows

- **Response envelope (Express):** every endpoint returns
  `{ success, data|error, meta: { requestId, timestamp } }` — see
  `server/src/utils/response.js`. Never hand-roll a response shape.
- **Validation:** Zod schemas + the `validate(schema)` middleware attach
  `request.validatedBody` — controllers read from that, never raw `request.body`,
  so mass-assignment is structurally impossible.
- **Errors:** throw `AppError(statusCode, code, message, details?)` from
  services; the centralized `errorHandler.js` converts it to the envelope.
  Never `res.status().json()` an error directly in a controller.
- **RBAC:** `authenticate` (verifies JWT, attaches `request.auth`) then
  `authorize('ROLE_NAME')` or `authorize('permission:some.permission')` —
  see `server/src/middlewares/authorize.js`.
- **Multi-tenancy scaffolding:** every controller resolves
  `organizationId` via `extractOrgId(req)` (header `x-organization-id`,
  falls back to a single default) — copy this pattern in new controllers
  rather than inventing a new one.
- **History-preserving collections:** `Decision`, `Explanation`,
  `EmployeeIntelligence`, `PredictionHistory`, `AuditLog` are insert-only —
  never `findOneAndUpdate` them. `Prediction` is the one deliberate
  exception (upserted, latest-only).
- **Structured logging:** `logger` from `server/src/utils/logger.js` (winston) —
  call `logger.info('event_name', { structuredField: value })`, never
  `console.log` in application code (the mock email service's console output
  is the one intentional exception — it's the visible artifact of a feature,
  not debug noise).

## Adding a new workflow entity type (e.g., a new commentable/attachable entity)

1. Add the type string to the relevant model's enum (`Comment.COMMENTABLE_TYPES`,
   `Attachment.ATTACHABLE_TYPES`).
2. No route/controller change needed — comments/attachments are already
   polymorphic (`entityType` + `entityId`).

## Adding a new Express endpoint

1. Controller function in `src/controllers/`, following the AppError/envelope conventions above.
2. Route registration in `src/routes/`, with `authenticate` + `authorize(...)`.
3. Mount the router in `src/app.js` if it's a new router file.
4. Add the path to `src/docs/openapi.js`'s `ROUTE_TABLE` (and a request/response
   example if it's a significant endpoint) — this is what powers `/api-docs`.
5. If it's a new pipeline category worth latency-tracking, add a matcher to
   `src/middlewares/metrics.js`'s `CATEGORY_MATCHERS`.

## Adding a new FastAPI endpoint

1. Route function in the relevant `app/api/*_routes.py`.
2. Register the router in `app/main.py` if new.
3. FastAPI's `/docs` picks it up automatically — no manual spec to maintain.
4. If it's a new pipeline category, add a prefix to `app/utils/metrics.py`'s
   `CATEGORY_PREFIXES`.

## Running things locally

```bash
cd server && npm run dev        # --watch, auto-restarts on file change
cd ai-service && uvicorn app.main:app --reload --port 8000
cd client && npm run dev
```

## Before opening a PR

```bash
cd server && npm run lint && npm test
cd client && npm run lint && npm run build
cd ai-service && pytest
```

See [CONTRIBUTING.md](../CONTRIBUTING.md) for branch/commit conventions.
