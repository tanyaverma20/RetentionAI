# Troubleshooting Guide

## "Local MongoDB not running. Starting in-memory MongoDB server..."

`server`'s `connectDatabase()` tries `MONGODB_URI` first and only falls back
to an ephemeral in-memory MongoDB (`mongodb-memory-server`) in development
when nothing answers on that URI. This is expected in a fresh dev
environment with no MongoDB installed — **but it means all data is wiped on
every server restart.** For persistent local data, either install MongoDB
locally, or run a fixed-port in-memory instance as its own long-lived
process before starting the server:
```js
// scripts/start_mongo.cjs (not checked in — create as needed)
const { MongoMemoryServer } = require('mongodb-memory-server');
MongoMemoryServer.create({ instance: { port: 27017, ip: '127.0.0.1' } })
  .then((m) => console.log('READY', m.getUri()));
```
Run this once, then start `server`/`ai-service` normally — both will find it
on port 27017 as if it were a real local MongoDB.

## `ai-service` fails to start with a GROQ_API_KEY error

`app/config.py`'s `validate_startup_config()` requires `GROQ_API_KEY` when
`AI_SERVICE_ENV=production`. In development, leave `AI_SERVICE_ENV` unset
(defaults to `development`) and the check is skipped — but the Decision
Engine will still fail *at request time* the first time it's actually used
without a real key, since `reasoning_chain.py` needs it to call Groq.

## `AI_SERVICE_UNAVAILABLE` / 503 from `/ai/predict` or `/decisions/*/generate`

- Confirm `ai-service` is actually running: `curl http://localhost:8000/health`.
- Confirm `AI_SERVICE_TOKEN` matches **exactly** between `server/.env` and `ai-service/.env`.
- Batch endpoints (`/predict/batch`, `/employee-intelligence/batch`) have a
  known responsiveness issue with large batches — prefer smaller batches or
  sequential single calls (documented tech debt, not yet root-caused).

## CORS errors on PUT requests specifically

Fixed in Sprint 10 — `server/src/app.js`'s CORS `methods` list previously
omitted `PUT`, silently breaking `/api/v1/hr/:collection/:id` updates for
cross-origin browser clients only (same-origin/curl testing never surfaces
this, since the browser preflight is what enforces it). If you see this
again, check `methods` includes `PUT`.

## Swagger UI at `/api-docs` renders blank

Helmet's default Content-Security-Policy blocks Swagger UI's inline
`<style>`/`<script>` tags. `app.js` scopes a relaxed CSP to `/api-docs`
specifically — if this regresses, check that scoping middleware is still in
place and running before Swagger UI's own middleware.

## `node --test` hangs or crashes without output (Windows only)

A known Node v24.x + Windows libuv issue during test-runner teardown when
tests spin up `mongodb-memory-server` instances, observed in this project
since Sprint 7. Symptoms: `node --test` produces no TAP output and never
exits, or crashes with `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)`.
Workarounds:
- Run a single test file at a time: `node --test tests/jwt.test.js`.
- Prefer reusing one already-running MongoDB instance across tests (a
  throwaway database name) over spinning up a fresh `MongoMemoryServer` per
  test file.
- If it still hangs, verify correctness via direct API calls against a
  running dev server instead of the automated suite — this is a documented,
  environment-specific limitation, not evidence the underlying code is broken.

## MongoDB crashes under heavy concurrent load (dev only)

An ephemeral in-memory MongoDB instance sharing a single machine with
`ai-service`'s full ML/NLP stack is not tuned for high concurrency — see
[Load-Testing-Report.md](./Load-Testing-Report.md). Use a real, dedicated
MongoDB (Atlas or a properly resourced host) for anything beyond light local
development.

## Disk fills up from leftover `mongo-mem-*` temp directories

Every `mongodb-memory-server` instance that's force-killed (rather than
cleanly stopped) leaves a ~200MB temp directory behind. Accumulated over
many restarts, this can fill a drive. Clean up safely with:
```bash
rm -rf "$TEMP"/mongo-mem-*
```
**only** after confirming no MongoDB process is still using them (check
`netstat`/`tasklist` for a live `mongod` process first).
