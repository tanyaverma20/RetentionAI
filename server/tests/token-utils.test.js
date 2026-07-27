import assert from 'node:assert/strict';
import test from 'node:test';

process.env.MONGODB_URI ??= 'mongodb://127.0.0.1:27017/retentionai_test';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-that-is-at-least-32-characters';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-that-is-at-least-32-characters';
process.env.CORS_ORIGINS ??= 'http://localhost:5173';

const { createPasswordResetToken, createRefreshToken, hashToken } =
  await import('../src/utils/tokens.js');

test('creates high-entropy refresh and password-reset tokens with stable hashes', () => {
  const refreshToken = createRefreshToken();
  const resetToken = createPasswordResetToken();

  assert.notEqual(refreshToken, resetToken);
  assert.equal(hashToken(refreshToken), hashToken(refreshToken));
  assert.notEqual(hashToken(refreshToken), refreshToken);
});
