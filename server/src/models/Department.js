/**
 * @file Department.js
 * @description Mongoose schema and model for company departments.
 *
 * Why this file exists
 * --------------------
 * Departments represent organizational units within the company. Employees belong
 * to a department, and department managers oversee employee performance and retention.
 *
 * Field decisions
 * ---------------
 * - `name`           – Department display name (e.g. "Engineering", "Human Resources").
 * - `code`           – Unique uppercase department code (e.g. "ENG", "HR", "FIN").
 * - `description`    – Summary of department scope and responsibilities.
 * - `location`       – Physical or remote work region for the department.
 * - `managerId`      – Reference to the User or Employee assigned as department manager.
 * - `isActive`       – Boolean toggle for active vs archived departments.
 *
 * Indexes
 * -------
 * - Unique `{ organizationId, code }` – Ensures unique department code within tenant scope.
 * - Unique `{ organizationId, name }` – Prevents duplicate department names within tenant scope.
 */

import mongoose from 'mongoose';

const departmentSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, index: true },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      minlength: 2,
      maxlength: 20,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },
    location: {
      type: String,
      trim: true,
      maxlength: 100,
      default: '',
    },
    managerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      default: null,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true },
);

departmentSchema.index({ organizationId: 1, code: 1 }, { unique: true });
departmentSchema.index({ organizationId: 1, name: 1 }, { unique: true });

export const Department = mongoose.model('Department', departmentSchema);
