/**
 * @file password.js
 * @description bcrypt password hashing and comparison helpers.
 *
 * Why this file exists
 * --------------------
 * All password operations are isolated here. Services never import bcrypt
 * directly, ensuring the algorithm and work factor are configured centrally
 * and consistently. Rotating the work factor requires changing only env config
 * and this file, not scattered service code.
 *
 * Security decisions
 * ------------------
 * - bcrypt is used rather than faster hashing algorithms (SHA-256, MD5, etc.)
 *   because its intentionally slow cost function makes brute-force attacks
 *   computationally expensive even with hardware acceleration.
 * - The work factor (salt rounds) is read from `env.bcryptSaltRounds`. The
 *   validated default is 12, which produces ~300 ms hashing time per password
 *   on modern server hardware — acceptable for authentication but expensive for
 *   attackers attempting dictionary attacks.
 * - `bcrypt.compare` uses constant-time comparison internally, preventing
 *   timing-based side-channel attacks.
 * - Raw plaintext passwords are never logged, stored, or returned anywhere in
 *   the system. Services receive only hashes.
 */

import bcrypt from 'bcrypt';
import { env } from '../config/env.js';

/**
 * Hash a plaintext password using bcrypt with the configured work factor.
 *
 * @param {string} password - Plaintext password from a validated request.
 * @returns {Promise<string>} bcrypt hash string.
 */
export function hashPassword(password) {
  return bcrypt.hash(password, env.bcryptSaltRounds);
}

/**
 * Compare a plaintext password against a stored bcrypt hash.
 * Uses `bcrypt.compare` which performs constant-time comparison.
 *
 * @param {string} password     - Plaintext candidate password.
 * @param {string} passwordHash - bcrypt hash from the database.
 * @returns {Promise<boolean>} `true` if the password matches the hash.
 */
export function comparePassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}
