import mongoose from 'mongoose';

const modelDriftLogSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true,
  },
  modelVersion: {
    type: String,
    required: true,
  },
  calculationDate: {
    type: Date,
    default: Date.now,
    index: true,
  },
  psiScore: {
    type: Number,
    required: true,
  },
  driftStatus: {
    type: String,
    enum: ['STABLE', 'MODERATE_DRIFT', 'SEVERE_DRIFT'],
    required: true,
  },
  baselineMeanRisk: {
    type: Number,
    required: true,
  },
  currentMeanRisk: {
    type: Number,
    required: true,
  },
  sampleSize: {
    type: Number,
    required: true,
  },
  evaluatedOutcomesCount: {
    type: Number,
    default: 0,
  },
  accuracyVsOutcomes: {
    type: Number,
  },
  idempotencyKey: {
    type: String,
    required: true,
    unique: true,
  },
}, { timestamps: true });

modelDriftLogSchema.index({ organizationId: 1, idempotencyKey: 1 }, { unique: true });

export const ModelDriftLog = mongoose.model('ModelDriftLog', modelDriftLogSchema);
