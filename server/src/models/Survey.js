import mongoose from 'mongoose';

const surveySchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    surveyDate: {
      type: Date,
      required: true,
    },
    engagementScore: {
      type: Number,
      min: 1,
      max: 5,
      required: true,
    },
    jobSatisfaction: {
      type: Number,
      min: 1,
      max: 5,
      required: true,
    },
    workLifeBalance: {
      type: Number,
      min: 1,
      max: 5,
      required: true,
    },
    stressLevel: {
      type: Number,
      min: 1,
      max: 5,
      required: true,
    },
    careerGrowthScore: {
      type: Number,
      min: 1,
      max: 5,
      required: true,
    },
    managerRelationshipScore: {
      type: Number,
      min: 1,
      max: 5,
      required: true,
    },
    surveyComments: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { timestamps: true },
);

surveySchema.index({ organizationId: 1, employeeId: 1, surveyDate: 1 });

export const Survey = mongoose.model('Survey', surveySchema);
