import mongoose from 'mongoose';

const attendanceSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    attendanceDate: {
      type: Date,
      required: true,
    },
    checkInTime: {
      type: Date,
      default: null,
    },
    checkOutTime: {
      type: Date,
      default: null,
    },
    totalHoursWorked: {
      type: Number,
      min: 0,
      default: 0,
    },
    overtimeHours: {
      type: Number,
      min: 0,
      default: 0,
    },
    attendanceStatus: {
      type: String,
      enum: ['PRESENT', 'ABSENT', 'HALF_DAY', 'ON_LEAVE', 'HOLIDAY'],
      required: true,
    },
    leaveType: {
      type: String,
      enum: ['SICK', 'CASUAL', 'ANNUAL', 'MATERNITY', 'PATERNITY', 'UNPAID', 'NONE'],
      default: 'NONE',
    },
    workMode: {
      type: String,
      enum: ['OFFICE', 'REMOTE', 'HYBRID'],
      default: 'OFFICE',
    },
    remarks: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { timestamps: true },
);

attendanceSchema.index({ organizationId: 1, employeeId: 1, attendanceDate: 1 }, { unique: true });

export const Attendance = mongoose.model('Attendance', attendanceSchema);
