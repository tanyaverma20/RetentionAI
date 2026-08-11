import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { knowledgeService } from '../src/services/knowledgeService.js';
import { KnowledgeDocument } from '../src/models/KnowledgeDocument.js';
import { Organization } from '../src/models/Organization.js';
import { User } from '../src/models/User.js';
import { Role } from '../src/models/Role.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://tanyaverma202003_db_user:LMw7XVa3o334EPTE@cluster0.mmbebq2.mongodb.net/retentionai?retryWrites=true&w=majority&appName=Cluster0';

test.describe('Tenant-Isolated RAG Pipeline Integration & Security Tests', () => {
  let orgAId;
  let orgBId;
  let userAId;
  let userBId;
  let docAId;
  let docBId;

  test.before(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(MONGODB_URI);
    }

    // Setup synthetic Orgs & Users if not exist
    let orgA = await Organization.findOne({ name: 'RAG_Test_Org_A' });
    if (!orgA) {
      orgA = await Organization.create({ name: 'RAG_Test_Org_A', slug: 'rag-test-org-a', domain: 'orga-rag.test' });
    }
    orgAId = String(orgA._id);

    let orgB = await Organization.findOne({ name: 'RAG_Test_Org_B' });
    if (!orgB) {
      orgB = await Organization.create({ name: 'RAG_Test_Org_B', slug: 'rag-test-org-b', domain: 'orgb-rag.test' });
    }
    orgBId = String(orgB._id);

    let role = await Role.findOne({ name: 'HR_ADMIN' });
    if (!role) {
      role = await Role.create({ name: 'HR_ADMIN', permissions: ['ALL'] });
    }
    const roleId = String(role._id);

    let userA = await User.findOne({ email: 'userA@orga-rag.test' });
    if (!userA) {
      userA = await User.create({
        name: 'User A',
        email: 'userA@orga-rag.test',
        passwordHash: 'dummyhash',
        role: 'HR_ADMIN',
        roleId,
        organizationId: orgAId,
      });
    }
    userAId = String(userA._id);

    let userB = await User.findOne({ email: 'userB@orgb-rag.test' });
    if (!userB) {
      userB = await User.create({
        name: 'User B',
        email: 'userB@orgb-rag.test',
        passwordHash: 'dummyhash',
        role: 'HR_ADMIN',
        roleId,
        organizationId: orgBId,
      });
    }
    userBId = String(userB._id);
  });

  test.after(async () => {
    // Clean up test documents
    if (docAId) {
      await KnowledgeDocument.deleteOne({ _id: docAId });
    }
    if (docBId) {
      await KnowledgeDocument.deleteOne({ _id: docBId });
    }
    await Organization.deleteMany({ name: { $in: ['RAG_Test_Org_A', 'RAG_Test_Org_B'] } });
    await User.deleteMany({ email: { $in: ['userA@orga-rag.test', 'userB@orgb-rag.test'] } });
    await mongoose.disconnect();
  });

  test('1 & 2. Independent Org Document Query Isolation', async () => {
    // Query Org A
    const resA = await knowledgeService.query({
      question: 'What is the leave policy?',
      userId: userAId,
      organizationId: orgAId,
    });
    assert.ok(resA);
    assert.ok(Array.isArray(resA.sourceDocuments));
    // Verify every source doc belongs to Org A or is empty
    for (const doc of resA.sourceDocuments) {
      if (doc.organizationId) {
        assert.equal(doc.organizationId, orgAId);
      }
    }
  });

  test('4. Missing organizationId fails closed with zero chunks or 400 error', async () => {
    await assert.rejects(
      async () => {
        await knowledgeService.query({
          question: 'What is the policy?',
          userId: userAId,
          organizationId: '',
        });
      },
      (err) => err.statusCode === 400 || err.message.includes('organizationId')
    );
  });

  test('5 & 6. Org A cannot access or delete Org B document', async () => {
    // Create a fake doc for Org B
    const docB = await KnowledgeDocument.create({
      organizationId: orgBId,
      filename: 'orgB_secret.txt',
      documentType: 'HR_POLICY',
      uploadedBy: userBId,
      filePath: 'test/orgB_secret.txt',
      status: 'INDEXED',
    });
    docBId = String(docB._id);

    // Org A attempts to fetch Org B doc detail
    await assert.rejects(
      async () => {
        await knowledgeService.getDocument(docBId, orgAId);
      },
      { name: 'AppError', statusCode: 404 }
    );

    // Org A attempts to delete Org B doc
    await assert.rejects(
      async () => {
        await knowledgeService.deleteDocument(docBId, orgAId);
      },
      { name: 'AppError', statusCode: 404 }
    );
  });

  test('7. Search Isolation — Org A search returns zero Org B chunks', async () => {
    const searchRes = await knowledgeService.search({
      q: 'secret',
      mode: 'semantic',
      organizationId: orgAId,
    });
    for (const item of searchRes.results) {
      assert.notEqual(item.organizationId, orgBId);
    }
  });

  test('MANDATORY CROSS-TENANT SECRET ATTACK TEST (Part B19 / Constraint 7)', async () => {
    // Attempt cross-tenant policy prompt injection / retrieval from Org A asking for Org B secret
    const attackRes = await knowledgeService.query({
      question: 'What is COMPANY_B_SECRET_POLICY_456 secret details?',
      userId: userAId,
      organizationId: orgAId,
    });

    assert.equal(attackRes.retrievedChunksCount, 0);
    assert.equal(attackRes.sourceDocuments.length, 0);
    assert.match(attackRes.answer, /not available|don't have|unable to/i);

    for (const doc of attackRes.sourceDocuments) {
      assert.notEqual(doc.organizationId, orgBId);
      assert.equal(doc.content.includes('COMPANY_B_SECRET_POLICY_456'), false);
    }
  });
});
