import assert from 'node:assert/strict';
import test from 'node:test';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  logoutSchema,
  refreshSchema,
  resetPasswordSchema,
} from '../src/validators/authValidators.js';

test('loginSchema validates email normalization and non-empty password', () => {
  const valid = loginSchema.safeParse({
    email: 'USER@Example.Com ',
    password: 'AnyPassword123',
  });
  assert.equal(valid.success, true);
  assert.equal(valid.data.email, 'user@example.com');

  const invalidEmail = loginSchema.safeParse({ email: 'not-an-email', password: 'pass' });
  assert.equal(invalidEmail.success, false);

  const missingPassword = loginSchema.safeParse({ email: 'user@example.com', password: '' });
  assert.equal(missingPassword.success, false);
});

test('loginSchema rejects unknown extra fields due to strict mode', () => {
  const result = loginSchema.safeParse({
    email: 'user@example.com',
    password: 'Password123',
    role: 'ADMIN',
  });
  assert.equal(result.success, false);
});

test('refreshSchema requires non-empty refresh token string', () => {
  assert.equal(refreshSchema.safeParse({ refreshToken: 'some-token-string' }).success, true);
  assert.equal(refreshSchema.safeParse({ refreshToken: '' }).success, false);
});

test('logoutSchema allows optional refreshToken', () => {
  assert.equal(logoutSchema.safeParse({}).success, true);
  assert.equal(logoutSchema.safeParse({ refreshToken: 'token-abc' }).success, true);
});

test('forgotPasswordSchema validates normalized email', () => {
  const result = forgotPasswordSchema.safeParse({ email: '  Test@Domain.org  ' });
  assert.equal(result.success, true);
  assert.equal(result.data.email, 'test@domain.org');
});

test('resetPasswordSchema validates token and new password policy', () => {
  const valid = resetPasswordSchema.safeParse({
    token: 'reset-token-123',
    newPassword: 'SecurePassword#2026',
  });
  assert.equal(valid.success, true);

  const weakPassword = resetPasswordSchema.safeParse({
    token: 'reset-token-123',
    newPassword: 'weak',
  });
  assert.equal(weakPassword.success, false);
});

test('changePasswordSchema validates current and new password shapes', () => {
  const valid = changePasswordSchema.safeParse({
    currentPassword: 'OldPassword1',
    newPassword: 'NewSecurePassword#2026',
  });
  assert.equal(valid.success, true);
});
