import mongoose from 'mongoose';

/** Task — Sprint 9 Part 2. HR work items, optionally spawned from an Intervention or Decision. */

const TASK_STATUSES = ['OPEN', 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'ESCALATED'];
const TASK_PRIORITIES = ['HIGH', 'MEDIUM', 'LOW'];
const SOURCE_TYPES = ['INTERVENTION', 'RECOMMENDATION', 'MANUAL'];

const ALLOWED_TASK_TRANSITIONS = {
  OPEN: ['IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'ESCALATED'],
  PENDING: ['IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'ESCALATED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED', 'ESCALATED'],
  COMPLETED: [],
  CANCELLED: [],
  ESCALATED: ['IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
};

const historyEntrySchema = new mongoose.Schema(
  {
    action: { type: String, required: true }, // CREATED | ASSIGNED | REASSIGNED | STATUS_CHANGED | ESCALATED | COMMENTED
    byUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    at: { type: Date, default: Date.now },
    note: { type: String, default: '' },
    fromValue: { type: String, default: null },
    toValue: { type: String, default: null },
  },
  { _id: false },
);

const taskSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: '', maxlength: 4000 },
    priority: { type: String, enum: TASK_PRIORITIES, default: 'MEDIUM', index: true },
    ownerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null, index: true },
    dueDate: { type: Date, default: null, index: true },
    status: { type: String, enum: TASK_STATUSES, default: 'OPEN', index: true },
    sourceType: { type: String, enum: SOURCE_TYPES, default: 'MANUAL' },
    sourceId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null, index: true },
    attachmentIds: { type: [mongoose.Schema.Types.ObjectId], ref: 'Attachment', default: [] },
    history: { type: [historyEntrySchema], default: [] },
    escalatedToUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    escalatedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    createdByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

taskSchema.index({ organizationId: 1, status: 1, dueDate: 1 });
taskSchema.index({ ownerUserId: 1, status: 1 });
taskSchema.index({ departmentId: 1, status: 1 });
taskSchema.index({ organizationId: 1, createdAt: -1 });

export const Task = mongoose.model('Task', taskSchema);
export { TASK_STATUSES, TASK_PRIORITIES, SOURCE_TYPES, ALLOWED_TASK_TRANSITIONS };
