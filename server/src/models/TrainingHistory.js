import mongoose from 'mongoose';

const trainingHistorySchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    courseName: {
      type: String,
      required: true,
      trim: true,
    },
    provider: {
      type: String,
      required: true,
      trim: true,
    },
    completionDate: {
      type: Date,
      required: true,
    },
    durationHours: {
      type: Number,
      min: 0,
      required: true,
    },
    certificationEarned: {
      type: Boolean,
      default: false,
    },
    score: {
      type: Number,
      min: 0,
      default: null,
    },
    remarks: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { timestamps: true },
);

trainingHistorySchema.index({ organizationId: 1, employeeId: 1, completionDate: 1 });

export const TrainingHistory = mongoose.model('TrainingHistory', trainingHistorySchema);
