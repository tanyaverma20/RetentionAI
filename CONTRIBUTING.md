# Contributing to RetentionAI

## Branching

- `main` — always deployable.
- Feature branches off `main`: `feature/<short-description>`, `fix/<short-description>`.

## Commit style

Conventional, imperative-mood subject lines:
```
feat(workflow): add task escalation endpoint
fix(auth): reject placeholder JWT secrets in production
docs(deployment): add Azure Container Apps guide
```

## Before opening a PR

```bash
cd server && npm run lint && npm test
cd client && npm run lint && npm run build
cd ai-service && pytest
```

All three must pass. If `server`'s integration tests hang on Windows (see
[TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md)), note that in the PR and
show equivalent verification via direct API calls instead — don't merge
without *some* form of verification evidence.

## Pull request checklist

Use [`.github/pull_request_template.md`](./.github/pull_request_template.md) —
summary, validation steps run, risk/documentation impact.

## Code conventions

See [docs/DEVELOPER-GUIDE.md](./docs/DEVELOPER-GUIDE.md) for the response
envelope, error handling, RBAC, and logging conventions this codebase
follows — new code should match them rather than introducing a new pattern.

## Scope discipline

This codebase has gone through 10 sprints of incremental, additive
development. When picking up a new task:
- Reuse existing services/models/patterns before adding new ones.
- Don't refactor unrelated code in the same PR as a feature/fix.
- Prefer fixing a root cause over adding a workaround, but don't expand a
  bug fix's scope into an unrelated redesign.
