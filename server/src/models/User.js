/**
 * @file User.js
 * @description Mongoose schema and model for user authentication accounts.
 *
 * Why this file exists
 * --------------------
 * The User document is the central authentication identity. It stores the
 * bcrypt-hashed credential, the role reference for RBAC, account lifecycle
 * state, and time-limited password-reset fields. It intentionally contains
 * no employee HR data — that lives in a separate Employee collection so that
 * an HR user account can be deactivated without deleting the employee record.
 *
 * Field decisions
 * ---------------
 * - `passwordHash`            – `select: false` ensures the hash is never
 *   returned in ordinary queries. Repository functions that need it call
 *   `.select('+passwordHash')` explicitly.
 * - `passwordResetTokenHash`  – Stored as an HMAC-SHA-256 hash, not plaintext,
 *   so a database dump yields no usable reset tokens.
 * - `passwordResetExpiresAt`  – Checked by the repository; expired tokens are
 *   treated as absent regardless of whether the document has been cleaned up.
 * - `status`                  – LOCKED prevents login for accounts that have
 *   failed repeated authentication attempts or been administratively suspended.
 * - `deletedAt`               – Soft-delete pattern preserves audit identity
 *   (the user appears in audit logs) while preventing login.
 * - `organizationId`          – Included now for the future multi-tenant path;
 *   the MVP uses a single organisation but queries are already scoped by it.
 *
 * Indexes
 * -------
 * - Unique compound `{organizationId, email}` – prevents duplicate accounts
 *   within the same organisation while allowing the same email across orgs.
 * - `{organizationId, roleId, status}` – supports admin user-list queries
 *   filtered by role and status without a full collection scan.
 */

import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, index: true },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    roleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Role',
      required: true,
    },
    /** Link to the Employee document for scope checks and self-service. */
    employeeId: { type: mongoose.Schema.Types.ObjectId, index: true },
    /** Pre-populated from the linked role for fast department-scope checks. */
    departmentId: { type: mongoose.Schema.Types.ObjectId, index: true },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE', 'LOCKED'],
      default: 'ACTIVE',
    },
    lastLoginAt: { type: Date },
    /** Set when the account is soft-deleted. Retained for audit identity. */
    deletedAt: { type: Date },
    /** HMAC-SHA-256 hash of the one-time reset token; never the raw token. */
    passwordResetTokenHash: { type: String, select: false },
    /** UTC expiry for the reset token. Expired tokens are treated as absent. */
    passwordResetExpiresAt: { type: Date, select: false },
  },
  { timestamps: true },
);

// Prevents two users with the same email in the same organisation.
userSchema.index({ organizationId: 1, email: 1 }, { unique: true });

// Efficient admin user-list queries filtered by role + status.
userSchema.index({ organizationId: 1, roleId: 1, status: 1 });

export const User = mongoose.model('User', userSchema);
