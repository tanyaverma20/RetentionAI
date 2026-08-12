import mongoose from 'mongoose';

const nodeTraceSchema = new mongoose.Schema({
  nodeName: {
    type: String,
    required: true,
  },
  inputStateSummary: {
    type: String,
  },
  outputStateSummary: {
    type: String,
  },
  durationMs: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    enum: ['SUCCESS', 'ERROR'],
    default: 'SUCCESS',
  },
}, { _id: false });

const agentTraceLogSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true,
  },
  decisionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Decision',
    required: true,
    index: true,
  },
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true,
  },
  executionId: {
    type: String,
    required: true,
    unique: true,
  },
  nodeTraces: [nodeTraceSchema],
  totalDurationMs: {
    type: Number,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
}, { timestamps: true });

agentTraceLogSchema.index({ organizationId: 1, decisionId: 1 });
agentTraceLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 24 * 60 * 60 }); // 60-day TTL

export const AgentTraceLog = mongoose.model('AgentTraceLog', agentTraceLogSchema);
