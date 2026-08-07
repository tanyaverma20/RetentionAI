/**
 * @file tenancy.js
 * @description Single source of truth for the pre-multi-tenant default
 * organization ID.
 *
 * Why this file exists
 * ---------------------
 * This app is transitioning from a single-tenant MVP (one seeded
 * organization) to real multi-tenancy. Until every existing User document
 * has been backfilled with its `organizationId`, `authenticate.js` falls
 * back to this constant so login keeps working for pre-existing accounts.
 *
 * This value must NEVER be read from client-controlled input (an
 * `x-organization-id` header, a body field, a query param). Every
 * controller used to define its own `extractOrgId(req)` helper that did
 * exactly that — trusting a header, with this same ID as the fallback —
 * which meant any authenticated user could access ANY organization's data
 * simply by setting that header. `authenticate.js` now resolves
 * `organizationId` once, server-side, from the verified JWT's user record,
 * and every controller reads `req.auth.organizationId` instead. This
 * constant only ever backstops that resolution — it is not, itself, a
 * trust boundary.
 */
export const DEFAULT_ORGANIZATION_ID = '60d5ec388832a828f8000000';
