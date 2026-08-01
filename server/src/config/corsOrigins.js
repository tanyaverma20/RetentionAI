/**
 * @file corsOrigins.js
 * @description Origin matching for the CORS allowlist.
 *
 * Why this file exists
 * --------------------
 * Exact-string matching against `CORS_ORIGINS` is correct for a stable custom
 * domain, but it breaks on platforms that mint a fresh hostname per deploy.
 * Vercel is the concrete case here: the project has one stable production
 * alias (`retention-ai-five.vercel.app`) *and* a per-deployment URL
 * (`retention-<build-hash>-<team>.vercel.app`) that the Vercel dashboard links
 * to. Opening the app from the dashboard therefore sends an Origin the server
 * has never seen, every browser request fails preflight, and the frontend
 * surfaces it as a generic "Login failed" — with no way to tell it apart from
 * a genuinely wrong password.
 *
 * So an allowlist entry may contain `*`, which matches within a single DNS
 * label (it will not match `.` or `/`). `https://retention-*-acme.vercel.app`
 * matches every deploy URL for that one project+team and nothing else.
 *
 * Security decisions
 * ------------------
 * - `*` never crosses a label boundary, so a pattern can't be widened into a
 *   parent domain by a crafted hostname.
 * - Patterns that would match an entire public suffix are rejected outright by
 *   `assertSafeOriginPattern` (see `env.js`, which enforces this in
 *   production). `*.vercel.app` is the trap worth naming: anyone can deploy to
 *   vercel.app, so that pattern trusts the whole internet. Pinning a literal
 *   team/project segment — `retention-*-acme.vercel.app` — is what makes the
 *   wildcard safe, because only this account can produce those hostnames.
 * - Matching is case-insensitive on the host (per RFC 4343) but the scheme is
 *   compared literally, so an `http://` origin never matches an `https://`
 *   entry.
 */

/**
 * Escape every regex metacharacter except `*`, which is translated separately.
 * @param {string} literal
 * @returns {string}
 */
function escapeRegexLiteral(literal) {
  return literal.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Compile one allowlist entry into a matcher.
 *
 * @param {string} pattern - Exact origin, or an origin containing `*`.
 * @returns {(origin: string) => boolean}
 */
function compileOriginPattern(pattern) {
  const normalised = pattern.trim();

  if (!normalised.includes('*')) {
    const expected = normalised.toLowerCase();
    return (origin) => origin.toLowerCase() === expected;
  }

  // `*` → one or more characters that are neither a label separator nor a
  // path separator, keeping the wildcard confined to a single DNS label.
  const source = normalised
    .split('*')
    .map(escapeRegexLiteral)
    .join('[^./]+');
  const regex = new RegExp(`^${source}$`, 'i');
  return (origin) => regex.test(origin);
}

/**
 * Reject wildcard patterns that trust more than the operator intends.
 *
 * Called from `env.js` for production boots. Returns an error string, or
 * `null` when the pattern is safe.
 *
 * @param {string} pattern
 * @returns {string | null}
 */
export function describeUnsafeOriginPattern(pattern) {
  const normalised = pattern.trim();
  if (!normalised.includes('*')) return null;

  if (normalised === '*') {
    return '"*" allows every origin.';
  }

  // Strip the scheme so the host can be inspected on its own.
  const host = normalised.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');

  if (host === '*' || host.startsWith('*.')) {
    return (
      `"${normalised}" wildcards an entire domain. Pin a literal project or ` +
      'team segment (e.g. "https://myapp-*-myteam.vercel.app") so the pattern ' +
      'cannot match hostnames belonging to someone else.'
    );
  }

  return null;
}

/**
 * Build an `isAllowed(origin)` predicate from the configured allowlist.
 *
 * @param {string[]} patterns - Entries from `CORS_ORIGINS`.
 * @returns {(origin: string) => boolean}
 */
export function createOriginMatcher(patterns) {
  const matchers = patterns.map(compileOriginPattern);
  return (origin) => matchers.some((matches) => matches(origin));
}
