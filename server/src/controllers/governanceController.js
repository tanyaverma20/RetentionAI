import * as governanceService from '../services/governanceService.js';
import { AiGuardrailLog } from '../models/AiGuardrailLog.js';
import { AiBiasAuditLog } from '../models/AiBiasAuditLog.js';

export const getGovernanceSummary = async (req, res, next) => {
  try {
    const organizationId = req.auth.organizationId;
    const summary = await governanceService.getGovernanceSummary(organizationId);
    return res.status(200).json({ status: 'success', data: summary });
  } catch (err) {
    return next(err);
  }
};

export const getGuardrailLogs = async (req, res, next) => {
  try {
    const organizationId = req.auth.organizationId;
    const logs = await AiGuardrailLog.find({ organizationId }).sort({ timestamp: -1 }).limit(100);
    return res.status(200).json({ status: 'success', data: logs });
  } catch (err) {
    return next(err);
  }
};

export const calculateBiasAudit = async (req, res, next) => {
  try {
    const organizationId = req.auth.organizationId;
    const userId = req.auth.id;
    const { demographicCategory, modelVersion } = req.body || {};

    const audit = await governanceService.calculateDemographicBiasAudit(organizationId, userId, {
      demographicCategory,
      modelVersion,
    });
    return res.status(200).json({ status: 'success', data: audit });
  } catch (err) {
    return next(err);
  }
};

export const getBiasHistory = async (req, res, next) => {
  try {
    const organizationId = req.auth.organizationId;
    const history = await AiBiasAuditLog.find({ organizationId }).sort({ calculatedAt: -1 }).limit(50);
    return res.status(200).json({ status: 'success', data: history });
  } catch (err) {
    return next(err);
  }
};

export const updatePolicy = async (req, res, next) => {
  try {
    const organizationId = req.auth.organizationId;
    const userId = req.auth.id;
    const policy = await governanceService.updatePolicy(organizationId, userId, req.body || {});
    return res.status(200).json({ status: 'success', data: policy });
  } catch (err) {
    return next(err);
  }
};

export const getHitlQueue = async (req, res, next) => {
  try {
    const organizationId = req.auth.organizationId;
    const queue = await governanceService.getHitlQueue(organizationId);
    return res.status(200).json({ status: 'success', data: queue });
  } catch (err) {
    return next(err);
  }
};

export const submitHitlReview = async (req, res, next) => {
  try {
    const organizationId = req.auth.organizationId;
    const userId = req.auth.id;
    const { decisionId } = req.params;
    const { action, reviewNote } = req.body || {};

    const updated = await governanceService.submitHitlReview(organizationId, userId, decisionId, {
      action,
      reviewNote,
    });
    return res.status(200).json({ status: 'success', data: updated });
  } catch (err) {
    return next(err);
  }
};

export const runRedTeamEval = async (req, res, next) => {
  try {
    const organizationId = req.auth.organizationId;
    const userId = req.auth.id;
    const result = await governanceService.runRedTeamHarness(organizationId, userId);
    return res.status(200).json({ status: 'success', data: result });
  } catch (err) {
    return next(err);
  }
};

export const exportGovernanceEvidence = async (req, res, next) => {
  try {
    const organizationId = req.auth.organizationId;
    const userId = req.auth.id;
    const report = await governanceService.generateGovernanceEvidenceReport(organizationId, userId);

    if (req.query.format === 'csv') {
      const csv = `Report Title,Organization ID,Generated At,Policy Version,Safety Shield Status,Disparate Impact Ratio\n"${report.reportTitle}","${report.organizationId}","${report.generatedAt}",${report.governancePolicyVersion},"${report.safetyShieldStatus}",${report.disparateImpactRatio}\n`;
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="ai-governance-evidence.csv"');
      return res.status(200).send(csv);
    }

    return res.status(200).json({ status: 'success', data: report });
  } catch (err) {
    return next(err);
  }
};
