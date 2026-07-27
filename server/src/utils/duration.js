/**
 * @file duration.js
 * @description Parse JWT-style duration strings into millisecond values.
 *
 * Why this file exists
 * --------------------
 * JWT libraries accept string durations such as `'15m'` or `'7d'` for
 * `expiresIn`, but when we need to compute an absolute `Date` for the refresh
 * token's `expiresAt` database field we must convert the same string to a
 * numeric millisecond offset. This utility does that conversion in one place
 * so the service layer never needs duplicated arithmetic.
 *
 * Supported units: s (seconds), m (minutes), h (hours), d (days).
 * The `JWT_REFRESH_TTL` environment variable is validated at startup to use one
 * of these units, so the throw path here is a last-resort guard.
 */

/**
 * Convert a duration string such as `'7d'` or `'15m'` to milliseconds.
 *
 * @param {string} value - Duration string with a numeric quantity and unit suffix.
 * @returns {number} Equivalent number of milliseconds.
 * @throws {Error} If the format is not recognised.
 *
 * @example
 * durationToMilliseconds('15m') // → 900000
 * durationToMilliseconds('7d')  // → 604800000
 */
export function durationToMilliseconds(value) {
  const match = /^(\d+)([smhd])$/.exec(value);
  if (!match) throw new Error('Duration must use a numeric quantity with a s, m, h, or d suffix.');

  const multipliers = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return Number(match[1]) * multipliers[match[2]];
}
