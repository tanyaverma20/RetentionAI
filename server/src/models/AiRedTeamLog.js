import mongoose from 'mongoose';

const aiRedTeamLogSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    evalVersion: {
      type: String,
      required: true,
    },
    attackCategory: {
      type: String,
      enum: ['PROMPT_INJECTION', 'JAILBREAK', 'MALICIOUS_RAG_DOC', 'PII_EXFILTRATION', 'CITATION_MANIPULATION', 'UNSUPPORTED_CLAIMS'],
      required: true,
    },
    testCaseName: {
      type: String,
      required: true,
    },
    expectedBehavior: {
      type: String,
      required: true,
    },
    actualBehavior: {
      type: String,
      required: true,
    },
    passFail: {
      type: String,
      enum: ['PASS', 'FAIL'],
      required: true,
    },
    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
    },
    executedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

aiRedTeamLogSchema.index({ organizationId: 1, executedAt: -1 });

export const AiRedTeamLog = mongoose.models.AiRedTeamLog || mongoose.model('AiRedTeamLog', aiRedTeamLogSchema);
