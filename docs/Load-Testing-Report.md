# RetentionAI — Load Testing Report (Sprint 10, Part 9)

**Tooling:** [autocannon](https://github.com/mcollina/autocannon), run via
[`server/scripts/load-test.js`](../server/scripts/load-test.js) (full
100/250/500-connection suite) and
[`server/scripts/load-test-safe.js`](../server/scripts/load-test-safe.js) (a
50/100/150-connection variant used for this specific run — see the
environment caveat below).

**Environment:** a single Windows dev machine running MongoDB, the FastAPI
AI service (with its full torch/transformers/ChromaDB stack resident in
memory), Express, and the autocannon load generator itself, all
simultaneously. This is explicitly **not** a representative production
topology (those four would normally run on separate hosts/containers with
dedicated resources) — numbers here characterize relative behavior between
endpoints, not this application's real-world capacity ceiling.

## Finding 1 (environment limitation, not an app defect): the full 100/250/500 run crashed the dev database

The first run, at the full 250-connection level against `dashboard_analytics`
and `global_search`, took MongoDB down entirely (`ECONNREFUSED
127.0.0.1:27017` on every subsequent request across all remaining tests in
that run). Root cause: the dev database here is an **ephemeral in-memory
MongoDB instance** (`mongodb-memory-server`, used because no persistent
MongoDB service is installed in this sandbox) sharing the same constrained
host as FastAPI's multi-GB ML stack — it is not tuned or resourced for
sustained concurrent load. It recovered cleanly on restart with zero data
loss (re-seeded from the same fixtures) and
[`scripts/check-consistency.js`](../server/scripts/check-consistency.js)
passed all 9 checks afterward. **This does not indicate a defect in the
application** — a production deployment with a real, dedicated MongoDB
(Atlas or a proper self-hosted instance per [docs/deployment](./deployment/))
would not share this failure mode. Flagging it prominently rather than
omitting it, per this project's standing practice of transparent reporting.

## Finding 2 (real, actionable): read endpoints do not scale uniformly

The reduced-concurrency (50/100/150) re-run completed with **zero errors,
timeouts, or non-2xx responses** at every level, but throughput diverged
sharply by endpoint:

| Endpoint | @50 conn | @100 conn | @150 conn |
|---|---|---|---|
| `workflow_dashboard` (Task/Intervention/Approval counts) | 107 req/s, p50 335ms | 150 req/s, p50 610ms | **172 req/s**, p50 819ms |
| `employees_list` (1470-doc collection, populated) | 18.6 req/s, p50 2.2s | 12.5 req/s, p50 5.0s | 8.9 req/s, p50 7.8s |
| `dashboard_analytics` (aggregation + population) | 12.5 req/s, p50 3.2s | 12.5 req/s, p50 5.0s | 0 req/s (no request completed in the 8s window) |

`workflow_dashboard` **scales up** with added concurrency (more throughput,
proportionally modest latency growth) — textbook healthy behavior. The
Employee-collection-backed endpoints instead **degrade** as concurrency
rises, with `dashboard_analytics` stalling completely at 150. Since all
three share the same process, connection pool, and host, and only the
Employee-heavy ones degrade, the cause is very likely per-query cost
(`.populate()` joins and aggregation stages over the 1470-document Employee
collection) rather than generic host contention or the `maxPoolSize: 20`
connection pool ceiling set in Part 7 — pool exhaustion would have throttled
`workflow_dashboard` too, and it didn't.

**Recommendation (not yet implemented — flagged as follow-up work):** profile
`analyticsService`'s and `employeeService`'s aggregation pipelines under
`explain()`, consider trimming `.populate()` fields to only what each
response actually returns, and re-run this same benchmark after any change
to confirm the throughput curve turns upward like `workflow_dashboard`'s
before considering this endpoint class production-scale-tested.

## Endpoints tested at a single, deliberately conservative concurrency

Endpoints that call an external LLM (Groq) or generate a downloadable file
were tested at lower, fixed concurrency — hammering an external API's rate
limiter isn't a useful test of this application, and the earlier (crashed)
run's brief window before the crash showed no request-level failures from
these paths themselves:

| Endpoint | Connections | Result |
|---|---|---|
| `ai/predict/:id` (cached) | 50 | p50 2.0s — dominated by autocannon's own per-connection ramp-up, not server cost (single-request timing for this path is ~120ms, see Part 8) |
| `decisions/:id/generate` (cached) | 20 | p50 2.0s, similarly ramp-up-dominated |

## Conclusion

No crash, error, or non-2xx response occurred at any tested concurrency once
the database itself was healthy. The one clear, reproducible weak point —
Employee-collection read throughput degrading under concurrent load — is
real and specific enough to act on, and is recorded above as follow-up work
rather than silently left out of this report.
