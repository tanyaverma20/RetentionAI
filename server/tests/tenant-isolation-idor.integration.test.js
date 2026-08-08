import assert from 'node:assert/strict';
import test from 'node:test';

/**
 * Prompt 1, Part 12/13/14 — horizontal-privilege-escalation (IDOR) tests for
 * every real cross-tenant vulnerability found and fixed in this pass:
 * Comments, Attachments (service-level — see note below), Tasks,
 * Interventions, Knowledge Documents, Decisions (single + status update),
 * Executive Alerts, global Search, and the CSV Reporting export.
 *
 * Pattern: Org A creates a real record; Org B (a fully separate tenant,
 * separate ADMIN user, separate JWT) attempts to read/list/mutate it by ID
 * or via a shared listing/search/export surface. Every such attempt must
 * come back exactly as if the record didn't exist (404, or absent from a
 * list/export/search result) — never a 403 that would confirm the ID is
 * valid, and never the real data.
 *
 * Attachment file-download is not exercised over HTTP here (multipart
 * upload construction adds real complexity for no extra coverage of the
 * fix itself); attachmentService.getById()/listForEntity() are called
 * directly instead, which still proves the organizationId filter added in
 * this pass without needing a full multer round trip.
 */
test(
  'cross-tenant IDOR: Comments, Tasks, Interventions, Knowledge, Decisions, Alerts, Search, Reporting export',
  async () => {
    let mongod;
    let databaseUri = process.env.AUTH_TEST_MONGODB_URI;

    if (!databaseUri) {
      const { MongoMemoryServer } = await import('mongodb-memory-server');
      mongod = await MongoMemoryServer.create();
      databaseUri = mongod.getUri();
    }

    process.env.NODE_ENV = 'test';
    process.env.MONGODB_URI = databaseUri;
    process.env.MONGODB_DB_NAME = 'retentionai_idor_test';
    process.env.JWT_ACCESS_SECRET = 'test-access-secret-that-is-at-least-32-characters';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-that-is-at-least-32-characters';
    process.env.CORS_ORIGINS = 'http://localhost:5173';

    const [
      { connectDatabase, disconnectDatabase },
      { ensureSystemRoles },
      { Role },
      { User },
      { Organization },
      { Employee },
      { Department },
      { Task },
      { Comment },
      { ExecutiveAlert },
      { Decision },
      { KnowledgeDocument },
      { app },
      { attachmentService },
    ] = await Promise.all([
      import('../src/config/database.js'),
      import('../src/services/roleService.js'),
      import('../src/models/Role.js'),
      import('../src/models/User.js'),
      import('../src/models/Organization.js'),
      import('../src/models/Employee.js'),
      import('../src/models/Department.js'),
      import('../src/models/Task.js'),
      import('../src/models/Comment.js'),
      import('../src/models/ExecutiveAlert.js'),
      import('../src/models/Decision.js'),
      import('../src/models/KnowledgeDocument.js'),
      import('../src/app.js'),
      import('../src/services/attachmentService.js'),
    ]);

    await connectDatabase();
    for (const Model of [User, Role, Organization, Employee, Department, Task, Comment, ExecutiveAlert, Decision, KnowledgeDocument]) {
      await Model.deleteMany({});
    }
    await ensureSystemRoles();

    const server = app.listen(0);
    const baseUrl = `http://127.0.0.1:${server.address().port}/api/v1`;

    const signup = async (organizationName, adminEmail) => {
      const res = await fetch(`${baseUrl}/organizations/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationName, adminName: 'Admin', adminEmail, adminPassword: 'Admin#12345' }),
      });
      const body = await res.json();
      assert.equal(res.status, 201, JSON.stringify(body));
      return { token: body.data.accessToken, orgId: body.data.organization.id, userId: body.data.user.id };
    };

    try {
      const orgA = await signup('Tenant Alpha', 'admin@alpha.test');
      const orgB = await signup('Tenant Beta', 'admin@beta.test');

      const authed = (token, extra = {}) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...extra });

      // Seed one department + employee in Org A (needed for Intervention/Decision).
      const createDept = await fetch(`${baseUrl}/departments`, {
        method: 'POST', headers: authed(orgA.token), body: JSON.stringify({ name: 'Engineering', code: 'ENG' }),
      });
      const deptBody = await createDept.json();
      assert.equal(createDept.status, 201, JSON.stringify(deptBody));
      const deptAId = deptBody.data.id ?? deptBody.data._id;

      const createEmp = await fetch(`${baseUrl}/employees`, {
        method: 'POST',
        headers: authed(orgA.token),
        body: JSON.stringify({
          employeeCode: 'EMP-A1', firstName: 'Erin', lastName: 'A', email: 'erin@alpha.test',
          departmentId: deptAId, designation: 'Engineer', joiningDate: '2024-01-15', salary: 100000,
        }),
      });
      const empABody = await createEmp.json();
      assert.equal(createEmp.status, 201, JSON.stringify(empABody));
      const empAId = empABody.data.id ?? empABody.data._id;

      // ── Tasks ────────────────────────────────────────────────────────
      const createTask = await fetch(`${baseUrl}/tasks`, {
        method: 'POST', headers: authed(orgA.token), body: JSON.stringify({ title: 'Org A confidential task' }),
      });
      const taskBody = await createTask.json();
      assert.equal(createTask.status, 201, JSON.stringify(taskBody));
      const taskAId = taskBody.data.id ?? taskBody.data._id;

      const taskDirectAsB = await fetch(`${baseUrl}/tasks/${taskAId}`, { headers: authed(orgB.token) });
      assert.equal(taskDirectAsB.status, 404, 'Org B must not be able to read Org A\'s task by ID');

      const assignAsB = await fetch(`${baseUrl}/tasks/${taskAId}/assign`, {
        method: 'PATCH', headers: authed(orgB.token), body: JSON.stringify({ ownerUserId: orgB.userId }),
      });
      assert.equal(assignAsB.status, 404, 'Org B must not be able to hijack Org A\'s task by reassigning it');

      const completeAsB = await fetch(`${baseUrl}/tasks/${taskAId}/complete`, { method: 'PATCH', headers: authed(orgB.token), body: '{}' });
      assert.equal(completeAsB.status, 404, 'Org B must not be able to mark Org A\'s task complete');

      const cancelAsB = await fetch(`${baseUrl}/tasks/${taskAId}/cancel`, { method: 'PATCH', headers: authed(orgB.token), body: '{}' });
      assert.equal(cancelAsB.status, 404, 'Org B must not be able to cancel Org A\'s task');

      const escalateAsB = await fetch(`${baseUrl}/tasks/${taskAId}/escalate`, {
        method: 'PATCH', headers: authed(orgB.token), body: JSON.stringify({ escalateToUserId: orgB.userId }),
      });
      assert.equal(escalateAsB.status, 404, 'Org B must not be able to escalate Org A\'s task to one of its own users');

      const taskStillOpen = await Task.findById(taskAId).lean();
      assert.equal(taskStillOpen.status, 'OPEN', 'none of Org B\'s attempted mutations may have actually changed Org A\'s task');

      // ── Comments ─────────────────────────────────────────────────────
      const createComment = await fetch(`${baseUrl}/comments`, {
        method: 'POST', headers: authed(orgA.token),
        body: JSON.stringify({ entityType: 'TASK', entityId: taskAId, body: 'Org A internal note' }),
      });
      const commentBody = await createComment.json();
      assert.equal(createComment.status, 201, JSON.stringify(commentBody));
      const commentAId = commentBody.data.id ?? commentBody.data._id;

      const commentsAsB = await fetch(`${baseUrl}/comments?entityType=TASK&entityId=${taskAId}`, { headers: authed(orgB.token) });
      const commentsAsBBody = await commentsAsB.json();
      assert.equal(commentsAsBBody.data.comments.length, 0, 'Org B must not see Org A\'s comments on Org A\'s task');

      const deleteCommentAsB = await fetch(`${baseUrl}/comments/${commentAId}`, { method: 'DELETE', headers: authed(orgB.token) });
      assert.equal(deleteCommentAsB.status, 404, 'Org B (even its own ADMIN) must not be able to delete Org A\'s comment');

      // ── Interventions ────────────────────────────────────────────────
      const createIntervention = await fetch(`${baseUrl}/interventions`, {
        method: 'POST', headers: authed(orgA.token),
        body: JSON.stringify({ employeeId: empAId, title: 'Retention conversation', priority: 'HIGH' }),
      });
      const interventionBody = await createIntervention.json();
      assert.equal(createIntervention.status, 201, JSON.stringify(interventionBody));
      const interventionAId = interventionBody.data.id ?? interventionBody.data._id;

      const interventionDirectAsB = await fetch(`${baseUrl}/interventions/${interventionAId}`, { headers: authed(orgB.token) });
      assert.equal(interventionDirectAsB.status, 404, 'Org B must not be able to read Org A\'s intervention (employee name, reasoning) by ID');

      const transitionAsB = await fetch(`${baseUrl}/interventions/${interventionAId}/status`, {
        method: 'PATCH', headers: authed(orgB.token), body: JSON.stringify({ status: 'CANCELLED' }),
      });
      assert.equal(transitionAsB.status, 404, 'Org B must not be able to cancel Org A\'s intervention');

      // Org B cannot even create an intervention referencing Org A's employee.
      const crossCreateIntervention = await fetch(`${baseUrl}/interventions`, {
        method: 'POST', headers: authed(orgB.token),
        body: JSON.stringify({ employeeId: empAId, title: 'Cross-tenant attempt', priority: 'HIGH' }),
      });
      assert.equal(crossCreateIntervention.status, 404, 'Org B must not be able to create an intervention against Org A\'s employeeId');

      // ── Decisions (AI recommendations) ──────────────────────────────
      const decision = await Decision.create({
        employeeId: empAId,
        organizationId: orgA.orgId,
        recommendationType: 'RETENTION_MEETING',
        priority: 'HIGH',
        confidence: 0.9,
        reasoning: 'Org A confidential AI reasoning',
        status: 'PENDING',
        statusHistory: [{ status: 'PENDING', changedBy: orgA.userId, changedAt: new Date(), note: 'Generated' }],
        generatedAt: new Date(),
        generatedBy: 'system',
      });

      const decisionDirectAsB = await fetch(`${baseUrl}/decisions/${empAId}`, { headers: authed(orgB.token) });
      assert.equal(decisionDirectAsB.status, 404, 'Org B must not be able to read Org A\'s AI recommendation for an employeeId');

      const decisionHistoryAsB = await fetch(`${baseUrl}/decisions/${empAId}/history`, { headers: authed(orgB.token) });
      const decisionHistoryAsBBody = await decisionHistoryAsB.json();
      assert.equal(decisionHistoryAsBBody.data.length, 0, 'Org B must not see any of Org A\'s decision history for that employeeId');

      const updateStatusAsB = await fetch(`${baseUrl}/decisions/status/${decision._id}`, {
        method: 'PATCH', headers: authed(orgB.token), body: JSON.stringify({ status: 'DISMISSED' }),
      });
      assert.equal(updateStatusAsB.status, 404, 'Org B must not be able to accept/dismiss Org A\'s AI recommendation');
      const decisionStillPending = await Decision.findById(decision._id).lean();
      assert.equal(decisionStillPending.status, 'PENDING', 'Org B\'s attempted status change must not have applied');

      // ── Knowledge Documents ──────────────────────────────────────────
      const knowledgeDoc = await KnowledgeDocument.create({
        organizationId: orgA.orgId,
        filename: 'org-a-confidential-policy.pdf',
        documentType: 'OTHER',
        uploadedBy: orgA.userId,
        filePath: 'documents/org-a-confidential-policy.pdf',
        fileSizeBytes: 1024,
        status: 'INDEXED',
      });

      const docDirectAsB = await fetch(`${baseUrl}/knowledge/documents/${knowledgeDoc._id}`, { headers: authed(orgB.token) });
      assert.equal(docDirectAsB.status, 404, 'Org B must not be able to read Org A\'s knowledge document metadata by ID');

      const docListAsB = await fetch(`${baseUrl}/knowledge/documents`, { headers: authed(orgB.token) });
      const docListAsBBody = await docListAsB.json();
      assert.equal(docListAsBBody.data.totalItems, 0, 'Org B\'s knowledge document list must not include Org A\'s document');

      const deleteDocAsB = await fetch(`${baseUrl}/knowledge/documents/${knowledgeDoc._id}`, { method: 'DELETE', headers: authed(orgB.token) });
      assert.equal(deleteDocAsB.status, 404, 'Org B must not be able to delete Org A\'s knowledge document');
      const docStillExists = await KnowledgeDocument.findById(knowledgeDoc._id).lean();
      assert.ok(docStillExists, 'Org A\'s knowledge document must survive Org B\'s attempted deletion');

      // ── Automation jobs (platform-wide side effects / info disclosure) ──
      // Found while auditing: the manual "run job now" / "list jobs"
      // endpoints previously ran/reported EVERY organization's automation
      // job in one call (automationService.runJob() is genuinely
      // all-org — intended for the internal scheduler only), letting any
      // tenant's ADMIN force side effects across every other tenant AND
      // enumerate every organizationId on the platform via the response.
      const runJobAsB = await fetch(`${baseUrl}/automation/jobs/DAILY_HR_DIGEST/run`, { method: 'POST', headers: authed(orgB.token) });
      const runJobAsBBody = await runJobAsB.json();
      assert.equal(runJobAsB.status, 200);
      assert.equal(runJobAsBBody.data.results.length, 1, 'a manually-triggered job must only run for the caller\'s own organization');
      assert.equal(runJobAsBBody.data.results[0].organizationId, orgB.orgId);

      const listJobsAsB = await fetch(`${baseUrl}/automation/jobs`, { headers: authed(orgB.token) });
      const listJobsAsBBody = await listJobsAsB.json();
      for (const run of Object.values(listJobsAsBBody.data.lastRuns)) {
        for (const result of run.results) {
          assert.equal(result.organizationId, orgB.orgId, 'Org B must never see another organization\'s ID/result in its own job-run log');
        }
      }

      // ── Executive Alerts ─────────────────────────────────────────────
      const alert = await ExecutiveAlert.create({
        organizationId: orgA.orgId,
        alertType: 'DEPARTMENT_BURNOUT',
        severity: 'HIGH',
        title: 'Org A burnout alert',
        description: 'Confidential internal alert',
      });

      const alertsAsB = await fetch(`${baseUrl}/executive/alerts`, { headers: authed(orgB.token) });
      const alertsAsBBody = await alertsAsB.json();
      assert.equal(alertsAsBBody.data.alerts.length, 0, 'Org B must not see Org A\'s executive alerts');

      const dismissAlertAsB = await fetch(`${baseUrl}/executive/alerts/${alert._id}/dismiss`, { method: 'PATCH', headers: authed(orgB.token) });
      assert.equal(dismissAlertAsB.status, 404, 'Org B must not be able to dismiss Org A\'s executive alert');

      const reviewAlertAsB = await fetch(`${baseUrl}/executive/alerts/${alert._id}/review`, { method: 'PATCH', headers: authed(orgB.token) });
      assert.equal(reviewAlertAsB.status, 404, 'Org B must not be able to mark Org A\'s executive alert reviewed');

      const assignAlertAsB = await fetch(`${baseUrl}/executive/alerts/${alert._id}/assign`, {
        method: 'PATCH', headers: authed(orgB.token), body: JSON.stringify({ assignedToUserId: orgB.userId }),
      });
      assert.equal(assignAlertAsB.status, 404, 'Org B must not be able to reassign Org A\'s executive alert to one of its own users');

      const alertUnchanged = await ExecutiveAlert.findById(alert._id).lean();
      assert.equal(alertUnchanged.status, 'OPEN', 'none of Org B\'s attempted alert mutations may have applied');

      // ── Global Search ────────────────────────────────────────────────
      const searchAsB = await fetch(`${baseUrl}/search?q=Erin`, { headers: authed(orgB.token) });
      const searchAsBBody = await searchAsB.json();
      assert.equal(searchAsBBody.data.employees.length, 0, 'Org B searching for Org A\'s employee name must return nothing');

      const searchDeptAsB = await fetch(`${baseUrl}/search?q=confidential`, { headers: authed(orgB.token) });
      const searchDeptAsBBody = await searchDeptAsB.json();
      assert.equal(searchDeptAsBBody.data.tasks.length, 0, 'Org B searching must not surface Org A\'s task titles');
      assert.equal(searchDeptAsBBody.data.knowledge.length, 0, 'Org B searching must not surface Org A\'s knowledge documents');

      // ── Reporting CSV export ─────────────────────────────────────────
      // Org A has a real employee; Org B has none. Before the Part 9/11/12
      // fix, this endpoint queried with no organizationId filter at all, so
      // Org B's export would have returned Org A's employee (full PII) —
      // the single most severe finding in this audit pass.
      const exportAsA = await fetch(`${baseUrl}/reports/employees/csv`, { headers: authed(orgA.token) });
      const csvA = await exportAsA.text();
      assert.equal(exportAsA.status, 200);
      assert.ok(csvA.includes('erin@alpha.test'), 'Org A\'s own export must contain its own employee');

      const exportAsB = await fetch(`${baseUrl}/reports/employees/csv`, { headers: authed(orgB.token) });
      const exportAsBBody = await exportAsB.json().catch(() => null);
      assert.equal(exportAsB.status, 404, 'Org B (with zero employees of its own) must get "no records", not Org A\'s data');
      if (exportAsBBody) {
        assert.equal(JSON.stringify(exportAsBBody).includes('erin@alpha.test'), false, 'Org B\'s export response must never contain Org A\'s employee data');
      }

      // ── Attachments (service-level — see file docstring) ─────────────
      const attachment = await attachmentService.create(
        orgA.orgId,
        { entityType: 'TASK', entityId: taskAId, file: { filename: 'secret.pdf', originalname: 'secret.pdf', mimetype: 'application/pdf', size: 10 } },
        orgA.userId,
      );
      const crossOrgAttachment = await attachmentService.getById(attachment._id, orgB.orgId).catch((e) => e);
      assert.ok(crossOrgAttachment instanceof Error, 'Org B must not be able to fetch Org A\'s attachment by ID');
      assert.equal(crossOrgAttachment.statusCode, 404);

      const crossOrgAttachmentList = await attachmentService.listForEntity(orgB.orgId, 'TASK', taskAId);
      assert.equal(crossOrgAttachmentList.length, 0, 'Org B must not see Org A\'s attachments even when it somehow knows the entityId');

      // Cross-tenant Task-linking guard: uploading against another org's
      // task ID must not append the attachment into that foreign task.
      const crossLinkAttempt = await attachmentService.create(
        orgB.orgId,
        { entityType: 'TASK', entityId: taskAId, file: { filename: 'x.pdf', originalname: 'x.pdf', mimetype: 'application/pdf', size: 1 } },
        orgB.userId,
      );
      const taskAfterCrossLink = await Task.findById(taskAId).lean();
      assert.ok(
        !taskAfterCrossLink.attachmentIds.some((id) => String(id) === String(crossLinkAttempt._id)),
        'Org B\'s attachment must not have been linked into Org A\'s task.attachmentIds',
      );
    } finally {
      await new Promise((resolve) => server.close(resolve));
      for (const Model of [User, Role, Organization, Employee, Department, Task, Comment, ExecutiveAlert, Decision, KnowledgeDocument]) {
        await Model.deleteMany({});
      }
      await disconnectDatabase();
      if (mongod) await mongod.stop();
    }
  },
);
