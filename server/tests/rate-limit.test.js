import assert from 'node:assert/strict';
import test from 'node:test';
import {
  forgotPasswordRateLimit,
  loginRateLimit,
  passwordChangeRateLimit,
  refreshRateLimit,
  resetPasswordRateLimit,
} from '../src/middlewares/rateLimits.js';

test('rate limiters are instantiated Express middleware functions', () => {
  assert.equal(typeof loginRateLimit, 'function');
  assert.equal(typeof refreshRateLimit, 'function');
  assert.equal(typeof forgotPasswordRateLimit, 'function');
  assert.equal(typeof resetPasswordRateLimit, 'function');
  assert.equal(typeof passwordChangeRateLimit, 'function');
});
