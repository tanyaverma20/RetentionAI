import assert from 'node:assert/strict';
import test from 'node:test';

process.env.MONGODB_URI ??= 'mongodb://127.0.0.1:27017/retentionai_test';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-that-is-at-least-32-characters';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-that-is-at-least-32-characters';
process.env.CORS_ORIGINS ??= 'http://localhost:5173';

const { createAccessToken, verifyAccessToken } = await import('../src/utils/tokens.js');

test('creates a valid JWT access token with expected payload claims', () => {
  const token = createAccessToken({
    id: 'user_12345',
    role: { name: 'ADMIN', permissions: ['*'] },
    organizationId: 'org_999',
  });

  assert.equal(typeof token, 'string');
  assert.ok(token.length > 20);

  const payload = verifyAccessToken(token);
  assert.equal(payload.sub, 'user_12345');
  assert.equal(payload.role, 'ADMIN');
  assert.equal(payload.organizationId, 'org_999');
  assert.equal(payload.type, 'access');
  assert.ok(payload.exp > payload.iat);
});

test('verifyAccessToken rejects malformed or invalid tokens', () => {
  assert.throws(() => verifyAccessToken('invalid.jwt.token'));
});
