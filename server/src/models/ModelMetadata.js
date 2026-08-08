/**
 * @file ModelMetadata.js
 * @description Mongoose schema for the `modelMetadata` collection.
 *
 * Why this file exists
 * ---------------------
 * Phase 1, item 3 of docs/PLATFORM_BLUEPRINT.md ("formalize the 5-model
 * comparison + PR-AUC auto-selection, publish the metrics table"). The
 * collection itself already existed — the ai-service's train_model.py
 * writes to it directly via pymongo after every training run — but there
 * was no Mongoose model for Express to read it back with. This is
 * read-mostly from Express's side: Python is the writer (see
 * ai-service/train_model.py), Express only queries it to serve the
 * dashboard.
 *
 * Field notes
 * -----------
 * - `benchmark` — the full 5-model comparison table (accuracy/precision/
 *   recall/F1/ROC-AUC/PR-AUC/cross-validated PR-AUC/training time/
 *   inference time/model size per family), keyed by algorithm name. Kept
 *   as Mixed rather than a strict sub-schema since the metric set is
 *   defined once, in ai-service/app/training/trainer.py, and duplicating
 *   that shape here would just be one more place to keep in sync.
 * - `selectionReason` — human-readable explanation of why this specific
 *   model won (PR-AUC ranking + the one-standard-error simplicity rule —
 *   see trainer.py's select_best_model), not just an assertion.
 * - Explicit third constructor argument pins the exact collection name
 *   ('modelMetadata', not Mongoose's default pluralized/lowercased
 *   'modelmetadatas') to match what Python already writes.
 */

import mongoose from 'mongoose';

const modelMetadataSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, index: true },
    version: { type: String },
    algorithm: { type: String },
    selectionReason: { type: String, default: '' },
    featureKeys: { type: [String], default: [] },
    metrics: { type: mongoose.Schema.Types.Mixed, default: {} },
    benchmark: { type: mongoose.Schema.Types.Mixed, default: {} },
    threshold: { type: Number },
    calibrationMethod: { type: String },
    artifactUri: { type: String },
    status: { type: String, enum: ['APPROVED', 'RETIRED'], default: 'APPROVED', index: true },
    trainedAt: { type: Date, index: true },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, default: null },
  },
  { timestamps: false },
);

modelMetadataSchema.index({ organizationId: 1, status: 1, trainedAt: -1 });

export const ModelMetadata = mongoose.model('ModelMetadata', modelMetadataSchema, 'modelMetadata');
