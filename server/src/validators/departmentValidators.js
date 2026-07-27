/**
 * @file departmentValidators.js
 * @description Zod request validation schemas for department endpoints.
 *
 * Why this file exists
 * --------------------
 * Ensures clean structural validation for department creation, updates, and manager assignments.
 */

import { z } from 'zod';
import { objectIdSchema } from './common.js';

export const createDepartmentSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Department name must be at least 2 characters.')
      .max(100, 'Department name must not exceed 100 characters.'),
    code: z
      .string()
      .trim()
      .min(2, 'Department code must be at least 2 characters.')
      .max(20, 'Department code must not exceed 20 characters.')
      .regex(/^[a-zA-Z0-9_-]+$/, 'Department code must contain only alphanumeric characters, hyphens, or underscores.'),
    description: z.string().trim().max(500, 'Description cannot exceed 500 characters.').optional(),
    location: z.string().trim().max(100, 'Location cannot exceed 100 characters.').optional(),
    managerId: objectIdSchema.nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

export const updateDepartmentSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Department name must be at least 2 characters.')
      .max(100, 'Department name must not exceed 100 characters.')
      .optional(),
    code: z
      .string()
      .trim()
      .min(2, 'Department code must be at least 2 characters.')
      .max(20, 'Department code must not exceed 20 characters.')
      .regex(/^[a-zA-Z0-9_-]+$/, 'Department code must contain only alphanumeric characters, hyphens, or underscores.')
      .optional(),
    description: z.string().trim().max(500, 'Description cannot exceed 500 characters.').optional(),
    location: z.string().trim().max(100, 'Location cannot exceed 100 characters.').optional(),
    managerId: objectIdSchema.nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((val) => Object.keys(val).length > 0, {
    message: 'At least one field is required for update.',
  });

export const assignDepartmentManagerSchema = z
  .object({
    managerId: objectIdSchema.nullable(),
  })
  .strict();
