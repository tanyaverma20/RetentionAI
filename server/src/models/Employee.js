/**
 * @file Employee.js
 * @description Mongoose schema and model for employee records.
 *
 * Why this file exists
 * --------------------
 * Stores comprehensive employee HR profile data, organizational structure,
 * employment metadata, and lifecycle status.
 * Separated from the User authentication model to maintain clear boundaries between
 * authentication credentials and employee records.
 *
 * Field decisions
 * ---------------
 * - `employeeCode`    – Unique employee ID string (e.g., "EMP-001").
 * - `email`           – Unique email address used for contact and user account matching.
 * - `departmentId`    – Ref to `Department` schema.
 * - `managerId`       – Ref to manager's `Employee` record.
 * - `userId`          – Optional link to corresponding `User` authentication record.
 * - `status`          – Enum (`ACTIVE`, `INACTIVE`, `TERMINATED`, `ON_LEAVE`).
 * - `isDeleted`       – Soft delete flag for auditability and compliance.
 *
 * Indexes
 * -------
 * - Unique `{ organizationId, employeeCode }`
 * - Unique `{ organizationId, email }`
 * - Compound `{ organizationId, departmentId, status, isDeleted }` for fast directory querying.
 */

import mongoose from 'mongoose';

const employeeSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, index: true },
    employeeCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 100,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 100,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    gender: {
      type: String,
      enum: ['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'],
      default: 'PREFER_NOT_TO_SAY',
    },
    dateOfBirth: {
      type: Date,
      default: null,
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: true,
      index: true,
    },
    designation: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    managerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      default: null,
      index: true,
    },
    joiningDate: {
      type: Date,
      required: true,
    },
    employmentType: {
      type: String,
      enum: ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN'],
      default: 'FULL_TIME',
    },
    salary: {
      type: Number,
      min: 0,
      default: 0,
    },
    workLocation: {
      type: String,
      trim: true,
      default: 'Office',
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE', 'TERMINATED', 'ON_LEAVE'],
      default: 'ACTIVE',
      index: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
  },
  { timestamps: true },
);

employeeSchema.index({ organizationId: 1, employeeCode: 1 }, { unique: true });
employeeSchema.index({ organizationId: 1, email: 1 }, { unique: true });
employeeSchema.index({ organizationId: 1, departmentId: 1, status: 1, isDeleted: 1 });
employeeSchema.index({ organizationId: 1, designation: 1 });

export const Employee = mongoose.model('Employee', employeeSchema);
