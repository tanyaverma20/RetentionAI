/**
 * @file invitationService.js
 * @description Secure, single-use, atomic user invitation service.
 */

import crypto from 'crypto';
import { Invitation } from '../models/Invitation.js';
import { User } from '../models/User.js';
import { Role } from '../models/Role.js';
import { createUser } from '../repositories/userRepository.js';
import { hashPassword } from '../utils/password.js';
import { recordAudit } from './auditService.js';
import { AppError } from '../errors/AppError.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';

const INVITATION_EXPIRATION_DAYS = 7;

function hashInvitationToken(token) {
  const secret = env.jwtAccessSecret || 'invitation-secret-key';
  return crypto.createHmac('sha256', secret).update(token).digest('hex');
}

export async function createInvitation({ organizationId, email, roleId, invitedByUserId }) {
  const normalizedEmail = email.trim().toLowerCase();

  // Check if active user already exists in tenant
  const existingUser = await User.findOne({ organizationId, email: normalizedEmail, deletedAt: null });
  if (existingUser) {
    throw new AppError(409, 'USER_ALREADY_EXISTS', 'A user account with this email already exists in your organization.');
  }

  // Validate role exists
  const role = await Role.findById(roleId);
  if (!role) {
    throw new AppError(404, 'ROLE_NOT_FOUND', 'Specified role does not exist.');
  }

  // Revoke any existing PENDING invitations for this email in this org
  await Invitation.updateMany(
    { organizationId, email: normalizedEmail, status: 'PENDING' },
    { status: 'REVOKED' },
  );

  // Generate cryptographically secure random token (32 bytes hex)
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashInvitationToken(rawToken);

  const expiresAt = new Date(Date.now() + INVITATION_EXPIRATION_DAYS * 24 * 60 * 60 * 1000);

  const invitation = await Invitation.create({
    organizationId,
    email: normalizedEmail,
    roleId,
    tokenHash,
    invitedBy: invitedByUserId,
    expiresAt,
    status: 'PENDING',
  });

  logger.info('invitation_created', { organizationId, email: normalizedEmail, roleId });

  await recordAudit(organizationId, 'INVITATION_CREATED', invitedByUserId, {
    entityType: 'INVITATION',
    entityId: invitation._id,
    context: { email: normalizedEmail, roleName: role.name },
  });

  return {
    invitation: {
      id: String(invitation._id),
      email: invitation.email,
      roleId: invitation.roleId,
      roleName: role.name,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      createdAt: invitation.createdAt,
    },
    // The raw token is returned ONCE to caller/email delivery mechanism; only the HMAC hash is stored in DB.
    invitationToken: rawToken,
  };
}

export async function listInvitations(organizationId) {
  const invitations = await Invitation.find({ organizationId })
    .populate('roleId', 'name permissions')
    .sort({ createdAt: -1 })
    .lean();

  const now = new Date();
  return invitations.map((inv) => ({
    id: String(inv._id),
    email: inv.email,
    roleName: inv.roleId?.name || 'UNKNOWN',
    status: inv.status === 'PENDING' && inv.expiresAt < now ? 'EXPIRED' : inv.status,
    expiresAt: inv.expiresAt,
    createdAt: inv.createdAt,
  }));
}

export async function revokeInvitation(organizationId, invitationId, adminUserId) {
  const invitation = await Invitation.findOne({ _id: invitationId, organizationId });
  if (!invitation) {
    throw new AppError(404, 'INVITATION_NOT_FOUND', 'Invitation not found.');
  }

  if (invitation.status !== 'PENDING') {
    throw new AppError(400, 'CANNOT_REVOKE', `Invitation cannot be revoked because it is ${invitation.status}.`);
  }

  invitation.status = 'REVOKED';
  await invitation.save();

  await recordAudit(organizationId, 'INVITATION_REVOKED', adminUserId, {
    entityType: 'INVITATION',
    entityId: invitation._id,
    context: { email: invitation.email },
  });

  return { success: true };
}

export async function acceptInvitation({ token, name, password }) {
  if (!token || typeof token !== 'string') {
    throw new AppError(400, 'INVALID_TOKEN', 'Invitation token is required.');
  }

  const tokenHash = hashInvitationToken(token);

  // ATOMIC CONSUMPTION: Atomically update PENDING -> ACCEPTED
  const invitation = await Invitation.findOneAndUpdate(
    {
      tokenHash,
      status: 'PENDING',
      expiresAt: { $gt: new Date() },
    },
    { status: 'ACCEPTED' },
    { new: false }, // Returns pre-update document
  );

  if (!invitation) {
    // Check if token exists but was already used, revoked, or expired
    const existing = await Invitation.findOne({ tokenHash }).select('+tokenHash').lean();
    if (!existing) {
      throw new AppError(404, 'INVITATION_NOT_FOUND', 'Invalid or expired invitation token.');
    }
    if (existing.status === 'ACCEPTED') {
      throw new AppError(409, 'INVITATION_ALREADY_USED', 'This invitation token has already been accepted.');
    }
    if (existing.status === 'REVOKED') {
      throw new AppError(400, 'INVITATION_REVOKED', 'This invitation has been revoked by an administrator.');
    }
    if (existing.expiresAt <= new Date()) {
      await Invitation.updateOne({ _id: existing._id }, { status: 'EXPIRED' });
      throw new AppError(400, 'INVITATION_EXPIRED', 'This invitation has expired.');
    }
    throw new AppError(400, 'INVITATION_INVALID', 'Invitation token is invalid.');
  }

  // Create new user account for the invited email within invitation.organizationId
  const passwordHash = await hashPassword(password);
  const newUser = await createUser({
    organizationId: invitation.organizationId,
    name,
    email: invitation.email,
    passwordHash,
    roleId: invitation.roleId,
    status: 'ACTIVE',
  });

  logger.info('invitation_accepted', {
    organizationId: invitation.organizationId,
    userId: newUser.id,
    email: invitation.email,
  });

  await recordAudit(invitation.organizationId, 'INVITATION_ACCEPTED', newUser._id, {
    entityType: 'USER',
    entityId: newUser._id,
    context: { email: invitation.email },
  });

  return {
    success: true,
    user: {
      id: String(newUser._id),
      name: newUser.name,
      email: newUser.email,
      organizationId: String(newUser.organizationId),
    },
  };
}
