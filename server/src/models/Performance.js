import mongoose from 'mongoose';

const performanceSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    reviewPeriod: {
      type: String, // e.g., 'Q1 2024', 'Annual 2024'
      required: true,
    },
    reviewerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },
    performanceScore: {
      type: Number,
      min: 1,
      max: 5,
      required: true,
    },
    goalAchievement: {
      type: Number,
      min: 0,
      default: 0,
    },
    strengths: {
      type: [String],
      default: [],
    },
    improvementAreas: {
      type: [String],
      default: [],
    },
    leadershipRating: {
      type: Number,
      min: 1,
      max: 5,
      default: 3,
    },
    teamworkRating: {
      type: Number,
      min: 1,
      max: 5,
      default: 3,
    },
    promotionRecommendation: {
      type: Boolean,
      default: false,
    },
    managerComments: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { timestamps: true },
);

performanceSchema.index({ organizationId: 1, employeeId: 1, reviewPeriod: 1 }, { unique: true });

export const Performance = mongoose.model('Performance', performanceSchema);
