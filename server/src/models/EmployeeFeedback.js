import mongoose from 'mongoose';

const employeeFeedbackSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    feedbackDate: {
      type: Date,
      required: true,
    },
    feedbackText: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      enum: ['MANAGEMENT', 'WORK_ENVIRONMENT', 'COMPENSATION', 'BENEFITS', 'OTHER'],
      default: 'OTHER',
    },
    anonymous: {
      type: Boolean,
      default: false,
    },
    visibility: {
      type: String,
      enum: ['HR_ONLY', 'MANAGER', 'PUBLIC'],
      default: 'HR_ONLY',
    },
    attachments: {
      type: [String],
      default: [],
    },
    source: {
      type: String,
      enum: ['SURVEY', 'FEEDBACK', 'REVIEW', 'EXIT_INTERVIEW', 'HR_NOTE', 'OTHER'],
      default: 'FEEDBACK',
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
    sentiment: {
      type: String,
      enum: ['Positive', 'Neutral', 'Negative'],
    },
    sentimentScore: {
      type: Number,
      min: 0,
      max: 1,
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1,
    },
    topics: {
      type: [String],
      default: [],
    },
    emotionSignals: {
      type: Map,
      of: Number,
    },
    summary: {
      type: String,
    },
    nlpProvider: {
      type: String,
      default: 'VADER+Transformers',
    },
    nlpModel: {
      type: String,
      default: 'roberta-go_emotions+distilbart',
    },
    nlpVersion: {
      type: String,
      default: '1.0.0',
    },
    analyzedAt: {
      type: Date,
    },
  },
  { timestamps: true },
);

employeeFeedbackSchema.index({ organizationId: 1, employeeId: 1, feedbackDate: 1 });
employeeFeedbackSchema.index({ organizationId: 1, employeeId: 1, submittedAt: -1 });

export const EmployeeFeedback = mongoose.model('EmployeeFeedback', employeeFeedbackSchema);
