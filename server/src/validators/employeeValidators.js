/**
 * @file employeeValidators.js
 * @description Zod request validation schemas for employee endpoints.
 *
 * Why this file exists
 * --------------------
 * Validates request payload structure, parameter data types, query string parameters,
 * and bulk import payloads for all Employee endpoints.
 */

import { z } from 'zod';
import { emailSchema, objectIdSchema } from './common.js';

const genderEnum = z.enum(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY']);
const employmentTypeEnum = z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN']);
const statusEnum = z.enum(['ACTIVE', 'INACTIVE', 'TERMINATED', 'ON_LEAVE']);

export const createEmployeeSchema = z
  .object({
    employeeCode: z
      .string()
      .trim()
      .min(2, 'Employee code must be at least 2 characters.')
      .max(30, 'Employee code must not exceed 30 characters.'),
    firstName: z
      .string()
      .trim()
      .min(1, 'First name is required.')
      .max(100, 'First name must not exceed 100 characters.'),
    lastName: z
      .string()
      .trim()
      .min(1, 'Last name is required.')
      .max(100, 'Last name must not exceed 100 characters.'),
    email: emailSchema,
    phone: z.string().trim().max(30, 'Phone number must not exceed 30 characters.').optional(),
    gender: genderEnum.optional().default('PREFER_NOT_TO_SAY'),
    dateOfBirth: z
      .string()
      .datetime({ offset: true })
      .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
      .optional()
      .nullable(),
    departmentId: objectIdSchema,
    designation: z
      .string()
      .trim()
      .min(1, 'Designation is required.')
      .max(100, 'Designation must not exceed 100 characters.'),
    managerId: objectIdSchema.nullable().optional(),
    joiningDate: z
      .string()
      .datetime({ offset: true })
      .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
    employmentType: employmentTypeEnum.optional().default('FULL_TIME'),
    salary: z.number().min(0, 'Salary must be non-negative.').optional().default(0),
    workLocation: z.string().trim().max(100, 'Work location must not exceed 100 characters.').optional(),
    status: statusEnum.optional().default('ACTIVE'),
    userId: objectIdSchema.nullable().optional(),
    profilePicture: z.string().trim().optional().nullable(),
    address: z.object({
      street:  z.string().trim().max(200).optional().default(''),
      city:    z.string().trim().max(100).optional().default(''),
      state:   z.string().trim().max(100).optional().default(''),
      country: z.string().trim().max(100).optional().default(''),
      zip:     z.string().trim().max(20).optional().default(''),
    }).optional(),
    emergencyContact: z.object({
      name:     z.string().trim().max(100).optional().default(''),
      phone:    z.string().trim().max(30).optional().default(''),
      relation: z.string().trim().max(50).optional().default(''),
    }).optional(),
    skills: z.array(z.string().trim().max(100)).optional().default([]),
    profileNotes: z.string().trim().max(2000).optional().default(''),
  })
  .strict();

export const updateEmployeeSchema = z
  .object({
    employeeCode: z.string().trim().min(2).max(30).optional(),
    firstName: z.string().trim().min(1).max(100).optional(),
    lastName: z.string().trim().min(1).max(100).optional(),
    email: emailSchema.optional(),
    phone: z.string().trim().max(30).optional(),
    gender: genderEnum.optional(),
    dateOfBirth: z
      .string()
      .datetime({ offset: true })
      .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
      .optional()
      .nullable(),
    departmentId: objectIdSchema.optional(),
    designation: z.string().trim().min(1).max(100).optional(),
    managerId: objectIdSchema.nullable().optional(),
    joiningDate: z
      .string()
      .datetime({ offset: true })
      .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
      .optional(),
    employmentType: employmentTypeEnum.optional(),
    salary: z.number().min(0).optional(),
    workLocation: z.string().trim().max(100).optional(),
    status: statusEnum.optional(),
    userId: objectIdSchema.nullable().optional(),
    profilePicture: z.string().trim().optional().nullable(),
    address: z.object({
      street:  z.string().trim().max(200).optional(),
      city:    z.string().trim().max(100).optional(),
      state:   z.string().trim().max(100).optional(),
      country: z.string().trim().max(100).optional(),
      zip:     z.string().trim().max(20).optional(),
    }).optional(),
    emergencyContact: z.object({
      name:     z.string().trim().max(100).optional(),
      phone:    z.string().trim().max(30).optional(),
      relation: z.string().trim().max(50).optional(),
    }).optional(),
    skills: z.array(z.string().trim().max(100)).optional(),
    profileNotes: z.string().trim().max(2000).optional(),
  })
  .strict()
  .refine((val) => Object.keys(val).length > 0, {
    message: 'At least one field is required for update.',
  });

export const bulkImportSchema = z
  .object({
    csvText: z.string().optional(),
    records: z.array(z.record(z.any())).optional(),
    mode: z.enum(['FULL_SNAPSHOT', 'PARTIAL_UPDATE']).optional().default('FULL_SNAPSHOT'),
    filename: z.string().optional().default('import.csv'),
  })
  .strict()
  .refine((val) => Boolean(val.csvText) || (Array.isArray(val.records) && val.records.length > 0), {
    message: 'Provide either csvText string or records array for bulk import.',
  });
