import mongoose from 'mongoose';

const predictionSchema = new mongoose.Schema({
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
    unique: true, // Only store the latest prediction per employee here
  },
  modelId: {
    type: String,
    required: true,
  },
  latestHistoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PredictionHistory',
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
  status: {
    type: String,
    enum: ['SUCCESS', 'FAILED'],
    default: 'SUCCESS',
  },
}, { timestamps: true });

export const Prediction = mongoose.model('Prediction', predictionSchema);
