/**
 * @file EmployeeChange.js
 * @description Mongoose model for tracking detailed employee field diffs during imports.
 *
 * Why this file exists
 * --------------------
 * Stores individual employee field changes per upload as separate documents, ensuring
 * that large imports do not exceed MongoDB document size limits on the parent Import summary.
 */

import mongoose from 'mongoose';

const employeeChangeSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    uploadId: {
      type: String,
      required: true,
      index: true,
    },
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    employeeCode: {
      type: String,
      required: true,
      index: true,
    },
    changedFields: [
      {
        field: { type: String, required: true },
        previousValue: { type: mongoose.Schema.Types.Mixed },
        newValue: { type: mongoose.Schema.Types.Mixed },
      },
    ],
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

employeeChangeSchema.index({ organizationId: 1, employeeId: 1, timestamp: -1 });
employeeChangeSchema.index({ organizationId: 1, uploadId: 1 });

export const EmployeeChange = mongoose.model('EmployeeChange', employeeChangeSchema);
