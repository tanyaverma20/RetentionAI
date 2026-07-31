import mongoose from 'mongoose';
import { Task } from '../models/Task.js';
import { Intervention } from '../models/Intervention.js';
import { Approval } from '../models/Approval.js';

function toObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id;
}

/** HR Operations Dashboard — Sprint 9 Part 7. Pure rollup over Task/Intervention/Approval; no new AI computation. */
export async function getWorkflowDashboard(organizationId) {
  const orgObjectId = toObjectId(organizationId);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  const now = new Date();

  const [
    pendingApprovals,
    openInterventions,
    tasksDueToday,
    overdueTasks,
    highPriorityTasks,
    highPriorityInterventions,
    recentlyCompletedTasks,
    recentlyCompletedInterventions,
    completedTasksForAvg,
    departmentWorkload,
    managerWorkload,
  ] = await Promise.all([
    Approval.countDocuments({ organizationId: orgObjectId, overallStatus: 'PENDING' }),
    Intervention.countDocuments({ organizationId: orgObjectId, status: { $nin: ['COMPLETED', 'REJECTED', 'CANCELLED'] } }),
    Task.find({ organizationId: orgObjectId, status: { $nin: ['COMPLETED', 'CANCELLED'] }, dueDate: { $gte: startOfToday, $lte: endOfToday } })
      .populate('ownerUserId', 'name')
      .lean(),
    Task.find({ organizationId: orgObjectId, status: { $nin: ['COMPLETED', 'CANCELLED'] }, dueDate: { $ne: null, $lt: now } })
      .populate('ownerUserId', 'name')
      .lean(),
    Task.find({ organizationId: orgObjectId, priority: 'HIGH', status: { $nin: ['COMPLETED', 'CANCELLED'] } })
      .sort({ dueDate: 1 })
      .limit(10)
      .populate('ownerUserId', 'name')
      .lean(),
    Intervention.find({ organizationId: orgObjectId, priority: 'HIGH', status: { $nin: ['COMPLETED', 'REJECTED', 'CANCELLED'] } })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('employeeId', 'firstName lastName')
      .lean(),
    Task.find({ organizationId: orgObjectId, status: 'COMPLETED' }).sort({ completedAt: -1 }).limit(10).populate('ownerUserId', 'name').lean(),
    Intervention.find({ organizationId: orgObjectId, status: 'COMPLETED' }).sort({ completedAt: -1 }).limit(10).populate('employeeId', 'firstName lastName').lean(),
    Task.find({ organizationId: orgObjectId, status: 'COMPLETED', completedAt: { $ne: null } }).select('createdAt completedAt').lean(),
    Task.aggregate([
      { $match: { organizationId: orgObjectId, status: { $nin: ['COMPLETED', 'CANCELLED'] } } },
      { $group: { _id: '$departmentId', count: { $sum: 1 } } },
      { $lookup: { from: 'departments', localField: '_id', foreignField: '_id', as: 'dept' } },
      { $unwind: { path: '$dept', preserveNullAndEmptyArrays: true } },
      { $project: { _id: 0, departmentId: '$_id', departmentName: { $ifNull: ['$dept.name', 'Unassigned'] }, count: 1 } },
      { $sort: { count: -1 } },
    ]),
    Task.aggregate([
      { $match: { organizationId: orgObjectId, status: { $nin: ['COMPLETED', 'CANCELLED'] }, ownerUserId: { $ne: null } } },
      { $group: { _id: '$ownerUserId', count: { $sum: 1 } } },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      { $unwind: '$user' },
      { $project: { _id: 0, userId: '$_id', name: '$user.name', count: 1 } },
      { $sort: { count: -1 } },
    ]),
  ]);

  const completionHours = completedTasksForAvg
    .map((t) => (new Date(t.completedAt) - new Date(t.createdAt)) / (1000 * 60 * 60))
    .filter((h) => Number.isFinite(h) && h >= 0);
  const avgCompletionTimeHours = completionHours.length
    ? Math.round((completionHours.reduce((a, b) => a + b, 0) / completionHours.length) * 10) / 10
    : null;

  return {
    generatedAt: new Date().toISOString(),
    pendingApprovals,
    openInterventions,
    tasksDueToday: tasksDueToday.length,
    tasksDueTodayList: tasksDueToday,
    overdueTasks: overdueTasks.length,
    overdueTasksList: overdueTasks,
    highPriorityActions: {
      tasks: highPriorityTasks,
      interventions: highPriorityInterventions,
    },
    recentlyCompleted: {
      tasks: recentlyCompletedTasks,
      interventions: recentlyCompletedInterventions,
    },
    avgCompletionTimeHours,
    departmentWorkload,
    managerWorkload,
  };
}

export const workflowService = { getWorkflowDashboard };
export default workflowService;
