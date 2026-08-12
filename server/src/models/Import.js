/**
 * @file Import.js
 * @description Mongoose model for tracking bulk employee data imports.
 *
 * Why this file exists
 * --------------------
 * Serves as an aggregate job summary for bulk employee uploads, storing top-level counts,
 * validation errors, and lifecycle status per organization without bloating documents
 * with individual row-level diffs (stored separately in EmployeeChange).
 */

import mongoose from 'mongoose';

const importSchema = new mongoose.Schema(
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
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    mode: {
      type: String,
      enum: ['FULL_SNAPSHOT', 'PARTIAL_UPDATE'],
      default: 'FULL_SNAPSHOT',
    },
    status: {
      type: String,
      enum: ['PREVIEW', 'PROCESSING', 'COMPLETED', 'FAILED'],
      default: 'PREVIEW',
    },
    stagedData: {
      type: mongoose.Schema.Types.Mixed,
      default: [],
    },
    filename: {
      type: String,
      default: 'import.csv',
    },
    totalRows: {
      type: Number,
      default: 0,
    },
    newCount: {
      type: Number,
      default: 0,
    },
    changedCount: {
      type: Number,
      default: 0,
    },
    unchangedCount: {
      type: Number,
      default: 0,
    },
    inactiveCount: {
      type: Number,
      default: 0,
    },
    validationErrorCount: {
      type: Number,
      default: 0,
    },
    validationErrors: [
      {
        row: { type: Number },
        error: { type: String },
      },
    ],
    predictionStatus: {
      type: String,
      enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'SKIPPED', 'FAILED'],
      default: 'PENDING',
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

importSchema.index({ organizationId: 1, uploadId: 1 }, { unique: true });
importSchema.index({ organizationId: 1, createdAt: -1 });

export const Import = mongoose.model('Import', importSchema);
