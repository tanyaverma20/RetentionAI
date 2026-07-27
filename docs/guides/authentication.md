# Authentication and Authorization Module

## Scope

This module implements the approved versioned authentication contract only: administrator-managed user creation, login, token refresh and revocation, current-user retrieval, password changes, password reset, JWT access-token verification, and role-based authorization. It does not add public registration, employee management, or any non-auth product workflow.

## Routes

| Route | Purpose |
|---|---|
| `POST /api/v1/auth/login` | Validates credentials and issues a signed access token plus an opaque refresh token. |
| `POST /api/v1/auth/refresh` | Rotates an active refresh token and issues a new token pair. |
| `POST /api/v1/auth/logout` | Revokes the supplied refresh token for the authenticated user. |
| `GET /api/v1/auth/me` | Returns the authenticated user's safe profile and role permissions. |
| `POST /api/v1/auth/change-password` | Verifies the current password, stores a new bcrypt hash, and revokes sessions. |
| `POST /api/v1/auth/forgot-password` | Creates a one-time hashed reset token without disclosing account existence. |
| `POST /api/v1/auth/reset-password` | Consumes a valid reset token, changes the password, and revokes sessions. |
| `POST /api/v1/users` | Lets an `ADMIN` create a user; there is no public registration route. |

## Security Decisions

- Passwords are never persisted or returned in plaintext; bcrypt uses a configurable work factor with a minimum of 10.
- Access tokens are short-lived HS256 JWTs. Refresh tokens are high-entropy opaque values, stored only as HMAC-SHA-256 values keyed by the refresh secret, rotated on refresh, and revocable on logout. This follows the BADD refresh-token contract.
- Reset tokens are also opaque, hashed, one-time, and expiration-bound. The generic forgot-password response prevents account enumeration.
- `authenticate()` rechecks the user and active status after JWT verification. `authorize(...roles)` performs server-side role enforcement.
- Zod schemas are strict and enforce email normalization, password complexity, identifier shape, and request-field allow-lists. Input sanitization rejects MongoDB operator-style keys.
- Helmet, configured CORS origins, JSON body limits, request IDs, and route-specific limits protect the public surface. Login is limited to five attempts per minute per IP/email pair.

## File Map

| Location | Why it exists |
|---|---|
| `server/src/config/env.js` | Validates runtime security settings before the server starts. |
| `server/src/config/database.js` | Owns the Mongoose connection lifecycle. |
| `server/src/config/roles.js` | Defines the five approved system roles and their baseline permissions. |
| `server/src/models/Role.js`, `User.js`, `RefreshToken.js` | Persist only auth-related role, identity, and revocable-session data. |
| `server/src/repositories/*Repository.js` | Centralizes database access for roles, users, and refresh tokens. |
| `server/src/services/authService.js` | Owns credential, token, reset, and session workflows. |
| `server/src/services/userService.js` | Creates administrator-managed users with a hashed password and resolved role reference. |
| `server/src/services/roleService.js` | Ensures the approved system roles exist after database connection. |
| `server/src/validators/*.js` | Defines strict Zod contracts and password policy. |
| `server/src/middlewares/*.js` | Implements request IDs, sanitization, validation, authentication, RBAC, limits, and safe error translation. |
| `server/src/controllers/*.js` and `routes/*.js` | Keep HTTP routing/adapters separate from auth business logic. |
| `server/tests/*.test.js` | Covers password policy, token hashing, and an opt-in MongoDB integration flow. |
| `server/.env.example` | Documents safe variable names and local development defaults without real credentials. |

## Tests

Run unit tests with `npm test` in `server/`. To run the integration test, set `AUTH_TEST_MONGODB_URI` to an isolated disposable MongoDB database; the test clears only that configured database's `users` and `roles` collections.
