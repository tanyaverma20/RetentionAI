import assert from 'node:assert/strict';
import test from 'node:test';
import { authorize } from '../src/middlewares/authorize.js';

test('authorize allows requests with matching role', () => {
  const middleware = authorize('ADMIN', 'HR_MANAGER');
  let nextCalled = false;
  let nextError = null;

  const req = { auth: { role: 'ADMIN', permissions: [] } };
  const res = {};
  const next = (err) => {
    nextCalled = true;
    nextError = err;
  };

  middleware(req, res, next);
  assert.equal(nextCalled, true);
  assert.equal(nextError, undefined);
});

test('authorize blocks requests without matching role or permission with 403 error', () => {
  const middleware = authorize('ADMIN');
  let errorReturned = null;

  const req = { auth: { role: 'EMPLOYEE', permissions: ['users.read'] } };
  const res = {};
  const next = (err) => {
    errorReturned = err;
  };

  middleware(req, res, next);
  assert.ok(errorReturned);
  assert.equal(errorReturned.statusCode, 403);
  assert.equal(errorReturned.code, 'FORBIDDEN');
});

test('authorize grants access to wildcard permission *', () => {
  const middleware = authorize('permission:analytics.read');
  let nextCalled = false;

  const req = { auth: { role: 'CUSTOM', permissions: ['*'] } };
  const res = {};
  const next = (err) => {
    if (!err) nextCalled = true;
  };

  middleware(req, res, next);
  assert.equal(nextCalled, true);
});

test('authorize grants access to exact permission string requirement', () => {
  const middleware = authorize('permission:users.write');
  let nextCalled = false;

  const req = { auth: { role: 'DEPT_MANAGER', permissions: ['users.read', 'users.write'] } };
  const res = {};
  const next = (err) => {
    if (!err) nextCalled = true;
  };

  middleware(req, res, next);
  assert.equal(nextCalled, true);
});
