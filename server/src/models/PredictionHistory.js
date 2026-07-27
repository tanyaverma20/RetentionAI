import mongoose from 'mongoose';

const predictionHistorySchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true,
  },
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true,
    index: true,
  },
  modelId: {
    type: String,
    required: true,
  },
  riskScore: {
    type: Number,
    required: true,
    min: 0,
    max: 1,
  },
  riskLevel: {
    type: String,
    enum: ['LOW', 'MEDIUM', 'HIGH'],
    required: true,
  },
  confidence: {
    type: Number,
    min: 0,
    max: 1,
  },
  predictedAt: {
    type: Date,
    default: Date.now,
  },
  runId: {
    type: String,
    required: true, // Group predictions from batch runs
    index: true,
  },
  status: {
    type: String,
    enum: ['SUCCESS', 'FAILED'],
    default: 'SUCCESS',
  },
}, { timestamps: true });

export const PredictionHistory = mongoose.model('PredictionHistory', predictionHistorySchema);
