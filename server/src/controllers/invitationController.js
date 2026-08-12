/**
 * @file invitationController.js
 * @description Controllers for user invitation endpoints.
 */

import * as invitationService from '../services/invitationService.js';

export async function createInvitation(req, res, next) {
  try {
    const { email, roleId } = req.body;
    const result = await invitationService.createInvitation({
      organizationId: req.auth.organizationId,
      email,
      roleId,
      invitedByUserId: req.auth.userId,
    });
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function listInvitations(req, res, next) {
  try {
    const data = await invitationService.listInvitations(req.auth.organizationId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function revokeInvitation(req, res, next) {
  try {
    const result = await invitationService.revokeInvitation(
      req.auth.organizationId,
      req.params.id,
      req.auth.userId,
    );
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function acceptInvitation(req, res, next) {
  try {
    const { token, name, password } = req.body;
    const result = await invitationService.acceptInvitation({ token, name, password });
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}
