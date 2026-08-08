import { z } from 'zod';

export const passwordPolicyRegex = {
  uppercase: /[A-Z]/,
  lowercase: /[a-z]/,
  number: /[0-9]/,
  special: /[!@#$%^&*(),.?":{}|<>_~-]/,
};

export const clientPasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters long.')
  .max(128, 'Password cannot exceed 128 characters.')
  .refine((val) => passwordPolicyRegex.uppercase.test(val), {
    message: 'Must contain at least one uppercase letter.',
  })
  .refine((val) => passwordPolicyRegex.lowercase.test(val), {
    message: 'Must contain at least one lowercase letter.',
  })
  .refine((val) => passwordPolicyRegex.number.test(val), {
    message: 'Must contain at least one number.',
  })
  .refine((val) => passwordPolicyRegex.special.test(val), {
    message: 'Must contain at least one special character.',
  });

export const loginValidationSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Email address is required.')
    .email('Please enter a valid email address.')
    .toLowerCase(),
  password: z.string().min(1, 'Password is required.'),
});

export const signupValidationSchema = z.object({
  organizationName: z
    .string()
    .trim()
    .min(2, 'Organization name must be at least 2 characters.')
    .max(200, 'Organization name must not exceed 200 characters.'),
  adminName: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters.')
    .max(100, 'Name must not exceed 100 characters.'),
  adminEmail: z
    .string()
    .trim()
    .min(1, 'Email address is required.')
    .email('Please enter a valid email address.')
    .toLowerCase(),
  adminPassword: clientPasswordSchema,
});

export const forgotPasswordValidationSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Email address is required.')
    .email('Please enter a valid email address.')
    .toLowerCase(),
});

export const resetPasswordValidationSchema = z
  .object({
    token: z.string().min(1, 'Reset token is required.'),
    newPassword: clientPasswordSchema,
    confirmPassword: z.string().min(1, 'Please confirm your new password.'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

export const changePasswordValidationSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required.'),
    newPassword: clientPasswordSchema,
    confirmPassword: z.string().min(1, 'Please confirm your new password.'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'New password must differ from current password.',
    path: ['newPassword'],
  });
