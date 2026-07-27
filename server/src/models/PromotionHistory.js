import mongoose from 'mongoose';

const promotionHistorySchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    previousRole: {
      type: String,
      required: true,
      trim: true,
    },
    newRole: {
      type: String,
      required: true,
      trim: true,
    },
    promotionDate: {
      type: Date,
      required: true,
    },
    salaryIncreasePercentage: {
      type: Number,
      min: 0,
      required: true,
    },
    reason: {
      type: String,
      trim: true,
      default: '',
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },
  },
  { timestamps: true },
);

promotionHistorySchema.index({ organizationId: 1, employeeId: 1, promotionDate: 1 });

export const PromotionHistory = mongoose.model('PromotionHistory', promotionHistorySchema);
