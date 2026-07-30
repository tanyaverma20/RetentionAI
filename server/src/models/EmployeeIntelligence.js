import mongoose from 'mongoose';

const employeeIntelligenceSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    sentiment: {
      type: String,
      enum: ['Positive', 'Neutral', 'Negative'],
      required: true,
    },
    sentimentScore: {
      type: Number,
      min: 0,
      max: 1,
    },
    emotion: {
      type: String,
      enum: ['Happy', 'Satisfied', 'Frustrated', 'Stressed', 'Burned Out', 'Demotivated'],
      required: true,
    },
    emotionBreakdown: {
      type: Map,
      of: Number,
    },
    burnoutRisk: {
      type: String,
      enum: ['Low', 'Medium', 'High'],
      required: true,
    },
    burnoutScore: {
      type: Number,
      min: 0,
      max: 1,
    },
    topics: {
      type: [String],
      default: [],
    },
    keywords: {
      type: [String],
      default: [],
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1,
    },
    summary: {
      type: String,
    },
    dataPoints: {
      type: Number,
      default: 0,
    },
    generatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

// Supports "latest per employee" lookups/joins (Employee Directory filters,
// Employee Profile, Dashboard) without a full collection scan. Insert-per-
// generation (never upserted) so history is preserved, matching the
// Explanation collection's pattern from the SHAP sprint.
employeeIntelligenceSchema.index({ employeeId: 1, generatedAt: -1 });
employeeIntelligenceSchema.index({ organizationId: 1, generatedAt: -1 });

const EmployeeIntelligence = mongoose.model('EmployeeIntelligence', employeeIntelligenceSchema);

export default EmployeeIntelligence;
