/**
 * @file Organization.js
 * @description Mongoose schema and model for a paying/trialing tenant.
 *
 * Why this file exists
 * ---------------------
 * Phase 1, item 2 of docs/PLATFORM_BLUEPRINT.md Part 2/19. Every domain
 * collection already carries an `organizationId` field (see Employee.js,
 * Decision.js, etc.) and requests are already scoped by
 * `req.auth.organizationId` (resolved from the verified JWT's User
 * document — see authenticate.js and the `fix(security)` commit that
 * closed the header-spoofing gap this depended on). What was missing was
 * an actual `Organization` document for that ID to point to, and a way for
 * a brand-new company to create one. This model is that document.
 *
 * No billing yet, deliberately (that's Phase 2): `plan`/`status` exist so
 * the schema doesn't need a migration when Stripe lands, but nothing reads
 * `stripeCustomerId`/`stripeSubscriptionId` yet, and `employeeLimit` is
 * stored but not yet enforced anywhere — see organizationService.js's
 * signUp() for that scope boundary spelled out explicitly.
 *
 * Field decisions
 * ---------------
 * - `slug` — unique, URL-safe identifier generated from `name` at signup
 *   (see organizationService.generateUniqueSlug). Reserved for future
 *   subdomain-per-tenant routing; not currently used for anything else.
 * - `status` — TRIALING is the only state signup can produce today; the
 *   others exist for when billing webhooks can transition it.
 * - `trialEndsAt` — informational only right now (nothing gates access on
 *   it yet); Phase 2 wires this into the usage-limit checks alongside
 *   employeeLimit.
 */

import mongoose from 'mongoose';

const organizationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 200,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    status: {
      type: String,
      enum: ['TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED'],
      default: 'TRIALING',
    },
    plan: {
      type: String,
      enum: ['FREE', 'GROWTH', 'ENTERPRISE'],
      default: 'FREE',
    },
    // Reserved for Phase 2 (Stripe) — unused until billing ships.
    stripeCustomerId: { type: String, default: null },
    stripeSubscriptionId: { type: String, default: null },
    // Plan ceiling, stored but not yet enforced (Phase 2 wires this in).
    employeeLimit: { type: Number, default: 50 },
    trialEndsAt: { type: Date },
  },
  { timestamps: true },
);

organizationSchema.index({ slug: 1 }, { unique: true });

export const Organization = mongoose.model('Organization', organizationSchema);
