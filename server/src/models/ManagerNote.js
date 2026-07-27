import mongoose from 'mongoose';

const managerNoteSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    managerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    noteDate: {
      type: Date,
      required: true,
    },
    observation: {
      type: String,
      required: true,
      trim: true,
    },
    recommendation: {
      type: String,
      trim: true,
      default: '',
    },
    performanceConcern: {
      type: Boolean,
      default: false,
    },
    promotionDiscussion: {
      type: Boolean,
      default: false,
    },
    followUpRequired: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

managerNoteSchema.index({ organizationId: 1, employeeId: 1, managerId: 1, noteDate: 1 });

export const ManagerNote = mongoose.model('ManagerNote', managerNoteSchema);
