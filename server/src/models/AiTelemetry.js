import mongoose from 'mongoose';

const aiTelemetrySchema = new mongoose.Schema({
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
    enum: ['PREDICTION', 'SHAP', 'NLP', 'RAG', 'LANGGRAPH'],
    required: true,
    index: true,
  },
  latencyMs: {
    type: Number,
    required: true,
  },
  promptTokens: {
    type: Number,
    default: 0,
  },
  completionTokens: {
    type: Number,
    default: 0,
  },
  totalTokens: {
    type: Number,
    default: 0,
  },
  estimatedCostUsd: {
    type: Number,
    default: 0,
  },
  groundednessScore: {
    type: Number,
    min: 0,
    max: 1,
  },
  citationCount: {
    type: Number,
    default: 0,
  },
  status: {
    type: String,
    enum: ['SUCCESS', 'FAILED', 'TIMEOUT'],
    default: 'SUCCESS',
  },
  errorMessage: {
    type: String,
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
}, { timestamps: true });

aiTelemetrySchema.index({ organizationId: 1, serviceType: 1, timestamp: -1 });
aiTelemetrySchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 }); // 90-day TTL

export const AiTelemetry = mongoose.model('AiTelemetry', aiTelemetrySchema);
