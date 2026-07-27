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
  },
  { timestamps: true },
);

employeeFeedbackSchema.index({ organizationId: 1, employeeId: 1, feedbackDate: 1 });

export const EmployeeFeedback = mongoose.model('EmployeeFeedback', employeeFeedbackSchema);
