import assert from 'node:assert/strict';
import test from 'node:test';
import { z } from 'zod';
import { AppError } from '../src/errors/AppError.js';
import { errorHandler, notFoundHandler } from '../src/middlewares/errorHandler.js';

function createMockResponse() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

test('AppError constructs with statusCode, code, message, and details', () => {
  const details = [{ field: 'email', rule: 'email', message: 'Invalid format' }];
  const error = new AppError(422, 'UNPROCESSABLE', 'Validation failed', details);

  assert.equal(error.name, 'AppError');
  assert.equal(error.statusCode, 422);
  assert.equal(error.code, 'UNPROCESSABLE');
  assert.equal(error.message, 'Validation failed');
  assert.deepEqual(error.details, details);
});

test('errorHandler formats AppError with status, code, message, and requestId', () => {
  const req = { requestId: 'req-abc-123' };
  const res = createMockResponse();
  const next = () => {};

  const error = new AppError(403, 'FORBIDDEN', 'Access denied to resource');
  errorHandler(error, req, res, next);

  assert.equal(res.statusCode, 403);
  assert.equal(res.body.success, false);
  assert.equal(res.body.error.code, 'FORBIDDEN');
  assert.equal(res.body.error.message, 'Access denied to resource');
  assert.equal(res.body.meta.requestId, 'req-abc-123');
});

test('errorHandler transforms MongoDB duplicate key 11000 into 409 Conflict', () => {
  const req = { requestId: 'req-dup-email' };
  const res = createMockResponse();

  const emailDupError = { code: 11000, message: 'E11000 duplicate key error collection: users index: email_1 dup key' };
  errorHandler(emailDupError, req, res, () => {});

  assert.equal(res.statusCode, 409);
  assert.equal(res.body.error.code, 'EMAIL_EXISTS');

  const genericDupError = { code: 11000, message: 'E11000 duplicate key error collection: depts index: code_1' };
  const resGeneric = createMockResponse();
  errorHandler(genericDupError, req, resGeneric, () => {});

  assert.equal(resGeneric.statusCode, 409);
  assert.equal(resGeneric.body.error.code, 'CONFLICT');
});

test('errorHandler transforms Mongoose ValidationError and CastError into 400 Bad Request', () => {
  const req = { requestId: 'req-val-1' };
  const res1 = createMockResponse();
  errorHandler({ name: 'ValidationError' }, req, res1, () => {});
  assert.equal(res1.statusCode, 400);
  assert.equal(res1.body.error.code, 'VALIDATION_ERROR');

  const res2 = createMockResponse();
  errorHandler({ name: 'CastError' }, req, res2, () => {});
  assert.equal(res2.statusCode, 400);
  assert.equal(res2.body.error.code, 'VALIDATION_ERROR');
});

test('errorHandler transforms ZodError into 400 Bad Request with field-level issues', () => {
  const req = { requestId: 'req-zod-1' };
  const res = createMockResponse();

  const testSchema = z.object({
    email: z.string().email(),
    age: z.number().min(18),
  });

  const parsed = testSchema.safeParse({ email: 'bad-email', age: 10 });
  assert.equal(parsed.success, false);

  errorHandler(parsed.error, req, res, () => {});

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  assert.ok(Array.isArray(res.body.error.details));
  assert.equal(res.body.error.details.length, 2);
  assert.equal(res.body.error.details[0].field, 'email');
  assert.equal(res.body.error.details[1].field, 'age');
});

test('errorHandler suppresses internal error message and stack trace on unexpected 500 exceptions', () => {
  const req = { requestId: 'req-secret-leak-test' };
  const res = createMockResponse();

  const unexpectedCrash = new Error('FATAL: failed to connect to secret-cluster.internal with key=SUPER_SECRET_123');
  unexpectedCrash.stack = 'Error: FATAL\n    at internal/db.js:99\n    at secretFunction()';

  errorHandler(unexpectedCrash, req, res, () => {});

  assert.equal(res.statusCode, 500);
  assert.equal(res.body.success, false);
  assert.equal(res.body.error.code, 'INTERNAL_ERROR');
  assert.equal(res.body.error.message, 'An unexpected error occurred.');
  assert.equal(res.body.meta.requestId, 'req-secret-leak-test');

  // Verify no internal secret or stack trace is leaked in response
  const stringified = JSON.stringify(res.body);
  assert.equal(stringified.includes('secret-cluster.internal'), false);
  assert.equal(stringified.includes('SUPER_SECRET_123'), false);
  assert.equal(stringified.includes('internal/db.js'), false);
});

test('notFoundHandler returns 404 with NOT_FOUND code and requestId', () => {
  const req = { requestId: 'req-not-found-404' };
  const res = createMockResponse();

  notFoundHandler(req, res);

  assert.equal(res.statusCode, 404);
  assert.equal(res.body.success, false);
  assert.equal(res.body.error.code, 'NOT_FOUND');
  assert.equal(res.body.meta.requestId, 'req-not-found-404');
});
