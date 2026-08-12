import mongoose from 'mongoose';

const aiGuardrailLogSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    requestId: {
      type: String,
      required: true,
      index: true,
    },
    serviceType: {
      type: String,
      enum: ['RAG', 'PREDICTION', 'DECISION_AGENT', 'FEEDBACK_NLP', 'RED_TEAM'],
      required: true,
    },
    eventCategory: {
      type: String,
      enum: ['PROMPT_INJECTION', 'JAILBREAK', 'PII_LEAK', 'SECRET_LEAK', 'TOXICITY', 'MALICIOUS_RAG_DOC', 'UNTRUSTED_INSTRUCTION_OVERRIDE'],
      required: true,
      index: true,
    },
    actionTaken: {
      type: String,
      enum: ['BLOCKED', 'SANITIZED', 'PASSED', 'LOGGED_ONLY'],
      required: true,
    },
    severity: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      required: true,
    },
    sanitizedMetadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

aiGuardrailLogSchema.index({ organizationId: 1, timestamp: -1 });
aiGuardrailLogSchema.index({ organizationId: 1, eventCategory: 1 });

export const AiGuardrailLog = mongoose.models.AiGuardrailLog || mongoose.model('AiGuardrailLog', aiGuardrailLogSchema);
