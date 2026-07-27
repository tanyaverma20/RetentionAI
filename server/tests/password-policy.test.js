import assert from 'node:assert/strict';
import test from 'node:test';
import { passwordSchema } from '../src/validators/common.js';

test('accepts a password that meets the approved security policy', () => {
  assert.equal(passwordSchema.safeParse('Secure#2026').success, true);
});

test('rejects passwords that do not contain all required character classes', () => {
  for (const password of ['lowercase#1', 'UPPERCASE#1', 'NoNumber#', 'NoSpecial123', 'A#1shrt']) {
    assert.equal(passwordSchema.safeParse(password).success, false);
  }
});
