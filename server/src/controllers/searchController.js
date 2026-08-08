import { Employee } from '../models/Employee.js';
import { Department } from '../models/Department.js';
import { Decision } from '../models/Decision.js';
import { Task } from '../models/Task.js';
import { Intervention } from '../models/Intervention.js';
import { Comment } from '../models/Comment.js';
import { KnowledgeDocument } from '../models/KnowledgeDocument.js';
import { sendSuccess } from '../utils/response.js';
import { logger } from '../utils/logger.js';

/**
 * Global enterprise search — Sprint 9 Part 8. Extends the original
 * Employee-only search into categorized results across every searchable
 * entity, without touching the Employee query logic that already existed.
 */
export async function globalSearch(request, response, next) {
  try {
    const { q, limit = 10 } = request.query;

    if (!q || q.length < 2) {
      return sendSuccess(response, 200, {
        employees: [], departments: [], recommendations: [], tasks: [], interventions: [], comments: [], knowledge: [],
      }, request.requestId);
    }

    const searchRegex = new RegExp(q, 'i');
    const n = Number(limit);
    const orgId = request.auth.organizationId;

    // Prompt 1, Part 9/11 — Employee/Department/Decision were previously
    // unscoped by organization while Task/Intervention/Comment/Knowledge
    // right below them already were: any authenticated user of ANY org
    // could search up another org's employees (name/email/PII), department
    // names, and AI recommendation reasoning through this one endpoint.
    // organizationId now comes from the authenticated caller (Part 10).
    const [employees, departments, recommendations, tasks, interventions, comments, knowledge] = await Promise.all([
      Employee.find({
        organizationId: orgId,
        isDeleted: false,
        $or: [
          { firstName: searchRegex }, { lastName: searchRegex }, { employeeCode: searchRegex },
          { designation: searchRegex }, { email: searchRegex }, { status: searchRegex },
        ],
      })
        .populate('departmentId', 'name code')
        .populate('managerId', 'firstName lastName')
        .limit(n)
        .lean(),

      Department.find({ organizationId: orgId, $or: [{ name: searchRegex }, { code: searchRegex }, { location: searchRegex }] })
        .limit(n)
        .lean(),

      Decision.find({ organizationId: orgId, $or: [{ recommendationType: searchRegex }, { reasoning: searchRegex }] })
        .populate('employeeId', 'firstName lastName')
        .sort({ generatedAt: -1 })
        .limit(n)
        .lean(),

      Task.find({ organizationId: orgId, $or: [{ title: searchRegex }, { description: searchRegex }] })
        .populate('ownerUserId', 'name')
        .limit(n)
        .lean(),

      Intervention.find({ organizationId: orgId, $or: [{ title: searchRegex }, { description: searchRegex }] })
        .populate('employeeId', 'firstName lastName')
        .limit(n)
        .lean(),

      Comment.find({ organizationId: orgId, isDeleted: false, body: searchRegex })
        .populate('authorUserId', 'name')
        .limit(n)
        .lean(),

      KnowledgeDocument.find({ organizationId: orgId, $or: [{ filename: searchRegex }, { documentType: searchRegex }, { tags: searchRegex }] })
        .limit(n)
        .lean(),
    ]);

    const formattedEmployees = employees.map((emp) => ({
      _id: emp._id,
      name: `${emp.firstName} ${emp.lastName}`,
      employeeCode: emp.employeeCode,
      department: emp.departmentId?.name || 'Unassigned',
      designation: emp.designation,
      email: emp.email,
      status: emp.status,
      manager: emp.managerId ? `${emp.managerId.firstName} ${emp.managerId.lastName}` : 'None',
      profilePicture: emp.profilePicture,
    }));

    const totalResults = formattedEmployees.length + departments.length + recommendations.length + tasks.length + interventions.length + comments.length + knowledge.length;
    logger.info('search_performed', { query: q, totalResults, userId: request.auth?.userId });

    return sendSuccess(response, 200, {
      employees: formattedEmployees,
      departments,
      recommendations,
      tasks,
      interventions,
      comments,
      knowledge,
    }, request.requestId);
  } catch (error) {
    return next(error);
  }
}
