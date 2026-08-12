let mongoServer;
let MONGODB_URI = process.env.AUTH_TEST_MONGODB_URI || process.env.MONGODB_URI;
if (!MONGODB_URI) {
  const { MongoMemoryServer } = await import('mongodb-memory-server');
  mongoServer = await MongoMemoryServer.create();
  MONGODB_URI = mongoServer.getUri();
}

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = MONGODB_URI;
process.env.JWT_ACCESS_SECRET = 'test-access-secret-that-is-at-least-32-characters';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-that-is-at-least-32-characters';
process.env.CORS_ORIGINS = 'http://localhost:5173';

import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

const { knowledgeService } = await import('../src/services/knowledgeService.js');
const { Organization } = await import('../src/models/Organization.js');
const { User } = await import('../src/models/User.js');
const { Role } = await import('../src/models/Role.js');

test.describe('Prompt 6 — Grounded RAG, Hybrid Retrieval & Tenant-Isolated Caching Tests', () => {
  let orgAId;
  let orgBId;
  let userAId;

  test.before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(MONGODB_URI);
    }

    let orgA = await Organization.findOne({ name: 'RAG_Groundedness_Org_A' });
    if (!orgA) {
      orgA = await Organization.create({ name: 'RAG_Groundedness_Org_A', slug: 'groundedness-org-a', domain: 'groundeda.test' });
    }
    orgAId = String(orgA._id);

    let orgB = await Organization.findOne({ name: 'RAG_Groundedness_Org_B' });
    if (!orgB) {
      orgB = await Organization.create({ name: 'RAG_Groundedness_Org_B', slug: 'groundedness-org-b', domain: 'groundedb.test' });
    }
    orgBId = String(orgB._id);

    let role = await Role.findOne({ name: 'HR_ADMIN' });
    if (!role) {
      role = await Role.create({ name: 'HR_ADMIN', permissions: ['ALL'] });
    }
    const roleId = String(role._id);

    let userA = await User.findOne({ email: 'userA@groundeda.test' });
    if (!userA) {
      userA = await User.create({
        name: 'Grounded User A',
        email: 'userA@groundeda.test',
        passwordHash: 'dummyhash',
        role: 'HR_ADMIN',
        roleId,
        organizationId: orgAId,
      });
    }
    userAId = String(userA._id);
  });

  test.after(async () => {
    await Organization.deleteMany({ name: { $in: ['RAG_Groundedness_Org_A', 'RAG_Groundedness_Org_B'] } });
    await User.deleteMany({ email: 'userA@groundeda.test' });
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  test('1. Hybrid Retrieval and Groundedness Response Contract', async () => {
    const res = await knowledgeService.query({
      question: 'What is the employee leave policy?',
      userId: userAId,
      organizationId: orgAId,
      retrievalMode: 'hybrid',
    });

    assert.ok(res, 'Query response should be defined');
    assert.equal(typeof res.answer, 'string');
    assert.equal(typeof res.latencyMs, 'number');
    assert.ok(res.groundednessScore !== undefined, 'groundednessScore should be present');
    assert.ok(res.retrievalMode === 'hybrid', 'retrievalMode should be hybrid');
    assert.equal(typeof res.cacheHit, 'boolean');
  });

  test('2. Tenant-Isolated RAG Query Cache hit & cross-tenant cache miss', async () => {
    const questionText = 'What are the performance evaluation rules?';

    // First query Org A — cache miss
    const resA1 = await knowledgeService.query({
      question: questionText,
      userId: userAId,
      organizationId: orgAId,
      retrievalMode: 'hybrid',
    });
    assert.equal(resA1.cacheHit, false, 'First query should be cache miss');

    // Second query Org A — cache hit if answered
    if (resA1.confidenceScore > 0 || resA1.groundednessScore > 0) {
      const resA2 = await knowledgeService.query({
        question: questionText,
        userId: userAId,
        organizationId: orgAId,
        retrievalMode: 'hybrid',
      });
      assert.equal(resA2.cacheHit, true, 'Second identical query for Org A should be cache hit');
    }

    // Identical query for Org B — MUST be cache miss for Org B (tenant isolation)
    const resB1 = await knowledgeService.query({
      question: questionText,
      userId: userAId,
      organizationId: orgBId,
      retrievalMode: 'hybrid',
    });
    assert.equal(resB1.cacheHit, false, 'Org B query MUST NOT hit Org A cache entry');
  });

  test('3. Fail-Closed Grounding — zero matching chunks returns ungrounded result', async () => {
    const ungroundedRes = await knowledgeService.query({
      question: 'NONEXISTENT_SECRET_XYZ_9999_QUERY',
      userId: userAId,
      organizationId: orgAId,
      retrievalMode: 'hybrid',
    });

    assert.equal(ungroundedRes.retrievedChunksCount, 0);
    assert.equal(ungroundedRes.confidenceScore, 0.0);
    assert.equal(ungroundedRes.groundednessScore, 0.0);
    assert.match(ungroundedRes.answer, /not available|don't have|unable to/i);
  });
});
