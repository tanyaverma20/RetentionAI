import { z } from 'zod';
import { objectIdSchema, paginationSchema } from './common.js';

export const attendanceCreateSchema = z.object({
  employeeId: objectIdSchema,
  attendanceDate: z.string().datetime(),
  checkInTime: z.string().datetime().nullable().optional(),
  checkOutTime: z.string().datetime().nullable().optional(),
  totalHoursWorked: z.number().min(0).optional(),
  overtimeHours: z.number().min(0).optional(),
  attendanceStatus: z.enum(['PRESENT', 'ABSENT', 'HALF_DAY', 'ON_LEAVE', 'HOLIDAY']),
  leaveType: z.enum(['SICK', 'CASUAL', 'ANNUAL', 'MATERNITY', 'PATERNITY', 'UNPAID', 'NONE']).optional(),
  workMode: z.enum(['OFFICE', 'REMOTE', 'HYBRID']).optional(),
  remarks: z.string().trim().optional(),
});

export const attendanceUpdateSchema = attendanceCreateSchema.partial();

export const performanceCreateSchema = z.object({
  employeeId: objectIdSchema,
  reviewPeriod: z.string().min(1),
  reviewerId: objectIdSchema,
  performanceScore: z.number().min(1).max(5),
  goalAchievement: z.number().min(0).optional(),
  strengths: z.array(z.string()).optional(),
  improvementAreas: z.array(z.string()).optional(),
  leadershipRating: z.number().min(1).max(5).optional(),
  teamworkRating: z.number().min(1).max(5).optional(),
  promotionRecommendation: z.boolean().optional(),
  managerComments: z.string().trim().optional(),
});

export const performanceUpdateSchema = performanceCreateSchema.partial();

export const surveyCreateSchema = z.object({
  employeeId: objectIdSchema,
  surveyDate: z.string().datetime(),
  engagementScore: z.number().min(1).max(5),
  jobSatisfaction: z.number().min(1).max(5),
  workLifeBalance: z.number().min(1).max(5),
  stressLevel: z.number().min(1).max(5),
  careerGrowthScore: z.number().min(1).max(5),
  managerRelationshipScore: z.number().min(1).max(5),
  surveyComments: z.string().trim().optional(),
});

export const surveyUpdateSchema = surveyCreateSchema.partial();

export const employeeFeedbackCreateSchema = z.object({
  employeeId: objectIdSchema,
  feedbackDate: z.string().datetime(),
  feedbackText: z.string().trim().min(1),
  category: z.enum(['MANAGEMENT', 'WORK_ENVIRONMENT', 'COMPENSATION', 'BENEFITS', 'OTHER']).optional(),
  anonymous: z.boolean().optional(),
  visibility: z.enum(['HR_ONLY', 'MANAGER', 'PUBLIC']).optional(),
  attachments: z.array(z.string()).optional(),
});

export const employeeFeedbackUpdateSchema = employeeFeedbackCreateSchema.partial();

export const managerNoteCreateSchema = z.object({
  employeeId: objectIdSchema,
  managerId: objectIdSchema,
  noteDate: z.string().datetime(),
  observation: z.string().trim().min(1),
  recommendation: z.string().trim().optional(),
  performanceConcern: z.boolean().optional(),
  promotionDiscussion: z.boolean().optional(),
  followUpRequired: z.boolean().optional(),
});

export const managerNoteUpdateSchema = managerNoteCreateSchema.partial();

export const trainingHistoryCreateSchema = z.object({
  employeeId: objectIdSchema,
  courseName: z.string().trim().min(1),
  provider: z.string().trim().min(1),
  completionDate: z.string().datetime(),
  durationHours: z.number().min(0),
  certificationEarned: z.boolean().optional(),
  score: z.number().min(0).optional(),
  remarks: z.string().trim().optional(),
});

export const trainingHistoryUpdateSchema = trainingHistoryCreateSchema.partial();

export const promotionHistoryCreateSchema = z.object({
  employeeId: objectIdSchema,
  previousRole: z.string().trim().min(1),
  newRole: z.string().trim().min(1),
  promotionDate: z.string().datetime(),
  salaryIncreasePercentage: z.number().min(0),
  reason: z.string().trim().optional(),
  approvedBy: objectIdSchema,
});

export const promotionHistoryUpdateSchema = promotionHistoryCreateSchema.partial();

export const hrQuerySchema = paginationSchema.extend({
  employeeId: objectIdSchema.optional(),
  managerId: objectIdSchema.optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});
