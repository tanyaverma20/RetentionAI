/**
 * @file analyticsRepository.js
 * @description Data access layer for analytics, KPI aggregation pipelines, and workforce metrics.
 *
 * Why this file exists
 * --------------------
 * Encapsulates all MongoDB aggregation pipelines and database queries for computing real-time
 * workforce metrics, departmental statistics, demographic breakdowns, trend lines, and career insights.
 */

import mongoose from 'mongoose';
import { Department } from '../models/Department.js';
import { Employee } from '../models/Employee.js';
import { Attendance } from '../models/Attendance.js';
import { Performance } from '../models/Performance.js';
import { Survey } from '../models/Survey.js';
import { TrainingHistory } from '../models/TrainingHistory.js';
import { PromotionHistory } from '../models/PromotionHistory.js';


/**
 * Helper to build Mongoose match condition from query filters.
 */
function buildMatchFilter(filter = {}) {
  const match = { isDeleted: false };

  if (filter.departmentId) {
    match.departmentId = mongoose.Types.ObjectId.isValid(filter.departmentId)
      ? new mongoose.Types.ObjectId(filter.departmentId)
      : filter.departmentId;
  }

  if (filter.employmentType) {
    match.employmentType = filter.employmentType;
  }

  if (filter.status) {
    match.status = filter.status;
  }

  if (filter.startDate || filter.endDate) {
    match.joiningDate = {};
    if (filter.startDate) match.joiningDate.$gte = new Date(filter.startDate);
    if (filter.endDate) match.joiningDate.$lte = new Date(filter.endDate);
  }

  if (filter.search) {
    const searchRegex = new RegExp(filter.search, 'i');
    match.$or = [
      { firstName: searchRegex },
      { lastName: searchRegex },
      { email: searchRegex },
      { employeeCode: searchRegex },
      { designation: searchRegex },
    ];
  }

  return match;
}

/**
 * Fetch aggregated KPI statistics.
 */
export async function getKpiSummary(filter = {}) {
  const match = buildMatchFilter(filter);
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [totalEmployees, activeEmployees, newHiresCount, departmentCount] = await Promise.all([
    Employee.countDocuments(match),
    Employee.countDocuments({ ...match, status: 'ACTIVE' }),
    Employee.countDocuments({
      ...match,
      joiningDate: { $gte: thirtyDaysAgo },
    }),
    filter.departmentId
      ? Department.countDocuments({ _id: filter.departmentId, isActive: true })
      : Department.countDocuments({ isActive: true }),
  ]);

  // Calculated / placeholder ML parameters
  const terminatedCount = await Employee.countDocuments({ ...match, status: 'TERMINATED' });
  const calculatedAttritionRate = totalEmployees > 0
    ? Number(((terminatedCount / totalEmployees) * 100).toFixed(1))
    : 3.5;

  // ── New HRMS KPIs ──
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  const [attendanceTodayCount, avgPerfResult, promotionDueCount, trainingCompletionResult] = await Promise.all([
    // Attendance today: count of PRESENT records for today
    Attendance.countDocuments({
      attendanceDate: { $gte: todayStart, $lte: todayEnd },
      attendanceStatus: 'PRESENT',
    }),
    // Average performance score across all reviews
    Performance.aggregate([
      { $group: { _id: null, avg: { $avg: '$performanceScore' } } },
    ]),
    // Promotion due: employees with promotionRecommendation = true
    Performance.countDocuments({ promotionRecommendation: true }),
    // Training completion: count of distinct employees who completed at least 1 training
    TrainingHistory.aggregate([
      { $group: { _id: '$employeeId' } },
      { $count: 'trainedEmployees' },
    ]),
  ]);

  const avgPerformance = avgPerfResult[0]?.avg
    ? Number(avgPerfResult[0].avg.toFixed(1))
    : 0;
  const trainedEmployees = trainingCompletionResult[0]?.trainedEmployees || 0;
  const trainingCompletion = activeEmployees > 0
    ? Number(((trainedEmployees / activeEmployees) * 100).toFixed(0))
    : 0;

  return {
    totalEmployees,
    activeEmployees,
    departmentCount,
    newHires30Days: newHiresCount,
    attendanceToday: attendanceTodayCount,
    avgPerformance,
    promotionDue: promotionDueCount,
    trainingCompletion,
    attritionRate: {
      value: calculatedAttritionRate,
      unit: '%',
      trend: 'down',
      isPlaceholder: true,
      label: 'Monthly Attrition Benchmark',
    },
    employeeSatisfaction: {
      value: 8.4,
      unit: '/ 10',
      trend: 'up',
      isPlaceholder: true,
      label: 'eNPS Index Score',
    },
  };
}

/**
 * Aggregates statistics per department (employee count, active count, avg experience, manager details).
 */
export async function getDepartmentAnalytics(filter = {}) {
  const match = buildMatchFilter(filter);

  const pipeline = [
    { $match: match },
    {
      $group: {
        _id: '$departmentId',
        employeeCount: { $sum: 1 },
        activeEmployees: {
          $sum: { $cond: [{ $eq: ['$status', 'ACTIVE'] }, 1, 0] },
        },
        avgExperienceYears: {
          $avg: {
            $divide: [
              { $subtract: [new Date(), '$joiningDate'] },
              1000 * 60 * 60 * 24 * 365.25,
            ],
          },
        },
      },
    },
    {
      $lookup: {
        from: 'departments',
        localField: '_id',
        foreignField: '_id',
        as: 'department',
      },
    },
    { $unwind: { path: '$department', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: 'employees',
        localField: 'department.managerId',
        foreignField: '_id',
        as: 'manager',
      },
    },
    { $unwind: { path: '$manager', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 1,
        departmentId: '$_id',
        departmentName: { $ifNull: ['$department.name', 'Unassigned'] },
        departmentCode: { $ifNull: ['$department.code', 'UNAS'] },
        location: { $ifNull: ['$department.location', 'HQ'] },
        employeeCount: 1,
        activeEmployees: 1,
        avgExperienceYears: { $round: [{ $ifNull: ['$avgExperienceYears', 0] }, 1] },
        manager: {
          $cond: [
            '$manager',
            {
              id: '$manager._id',
              name: { $concat: ['$manager.firstName', ' ', '$manager.lastName'] },
              email: '$manager.email',
              designation: '$manager.designation',
            },
            null,
          ],
        },
      },
    },
    { $sort: { employeeCount: -1 } },
  ];

  return Employee.aggregate(pipeline);
}

/**
 * Aggregates demographic distribution statistics (Department, Gender, Employment Type, Experience).
 */
export async function getDemographicDistributions(filter = {}) {
  const match = buildMatchFilter(filter);

  const [byDepartment, byGender, byEmploymentType, experienceFacet] = await Promise.all([
    // Employees by Department
    Employee.aggregate([
      { $match: match },
      { $group: { _id: '$departmentId', count: { $sum: 1 } } },
      {
        $lookup: {
          from: 'departments',
          localField: '_id',
          foreignField: '_id',
          as: 'dept',
        },
      },
      { $unwind: { path: '$dept', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          name: { $ifNull: ['$dept.name', 'Unassigned'] },
          code: { $ifNull: ['$dept.code', 'UNAS'] },
          count: 1,
        },
      },
      { $sort: { count: -1 } },
    ]),

    // Employees by Gender
    Employee.aggregate([
      { $match: match },
      { $group: { _id: '$gender', count: { $sum: 1 } } },
      { $project: { label: '$_id', count: 1, _id: 0 } },
    ]),

    // Employees by Employment Type
    Employee.aggregate([
      { $match: match },
      { $group: { _id: '$employmentType', count: { $sum: 1 } } },
      { $project: { label: '$_id', count: 1, _id: 0 } },
    ]),

    // Experience Ranges
    Employee.aggregate([
      { $match: match },
      {
        $project: {
          yearsOfExp: {
            $divide: [
              { $subtract: [new Date(), '$joiningDate'] },
              1000 * 60 * 60 * 24 * 365.25,
            ],
          },
        },
      },
      {
        $bucket: {
          groupBy: '$yearsOfExp',
          boundaries: [0, 1, 3, 5, 10, 50],
          default: '50+',
          output: { count: { $sum: 1 } },
        },
      },
    ]),
  ]);

  // Format experience ranges for UI charts
  const experienceDistribution = [
    { range: '< 1 Year', count: experienceFacet.find((b) => b._id === 0)?.count || 0 },
    { range: '1 - 3 Years', count: experienceFacet.find((b) => b._id === 1)?.count || 0 },
    { range: '3 - 5 Years', count: experienceFacet.find((b) => b._id === 3)?.count || 0 },
    { range: '5 - 10 Years', count: experienceFacet.find((b) => b._id === 5)?.count || 0 },
    { range: '10+ Years', count: experienceFacet.find((b) => b._id === 10)?.count || 0 },
  ];

  return {
    byDepartment,
    byGender,
    byEmploymentType,
    experienceDistribution,
  };
}

/**
 * Aggregates monthly hiring and attrition trends over past 12 months.
 */
export async function getMonthlyTrends(filter = {}) {
  const match = buildMatchFilter(filter);
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
  twelveMonthsAgo.setDate(1);

  const hiringPipeline = [
    {
      $match: {
        ...match,
        joiningDate: { $gte: twelveMonthsAgo },
      },
    },
    {
      $group: {
        _id: {
          year: { $year: '$joiningDate' },
          month: { $month: '$joiningDate' },
        },
        hires: { $sum: 1 },
      },
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } },
  ];

  const hiringResults = await Employee.aggregate(hiringPipeline);

  // Generate 12-month array with labels (e.g. Jan 2026, Feb 2026...)
  const monthlyTrends = [];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  for (let i = 0; i < 12; i++) {
    const d = new Date(twelveMonthsAgo.getFullYear(), twelveMonthsAgo.getMonth() + i, 1);
    const yr = d.getFullYear();
    const m = d.getMonth() + 1;
    const label = `${monthNames[d.getMonth()]} ${yr}`;

    const matchHires = hiringResults.find(
      (r) => r._id.year === yr && r._id.month === m,
    );

    // Placeholder simulated monthly attrition trend baseline
    const simulatedAttrition = Math.max(0, Math.floor((matchHires?.hires || 2) * 0.3));

    monthlyTrends.push({
      monthLabel: label,
      year: yr,
      month: m,
      hires: matchHires ? matchHires.hires : 0,
      attrition: simulatedAttrition,
      isPlaceholder: true,
    });
  }

  return monthlyTrends;
}

/**
 * Fetches employee career insights (Recent hires, anniversaries, birthdays, recent additions).
 */
export async function getEmployeeInsights(filter = {}) {
  const match = buildMatchFilter(filter);
  const currentMonth = new Date().getMonth() + 1;
  const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;

  const [recentHires, recentlyAdded, allEmployees] = await Promise.all([
    Employee.find(match)
      .sort({ joiningDate: -1 })
      .limit(5)
      .populate('departmentId', 'name code')
      .lean(),
    Employee.find(match)
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('departmentId', 'name code')
      .lean(),
    Employee.find(match)
      .populate('departmentId', 'name code')
      .lean(),
  ]);

  // Filter anniversaries in current / next month
  const upcomingAnniversaries = allEmployees
    .filter((emp) => {
      if (!emp.joiningDate) return false;
      const m = new Date(emp.joiningDate).getMonth() + 1;
      return m === currentMonth || m === nextMonth;
    })
    .slice(0, 5)
    .map((emp) => {
      const joinYear = new Date(emp.joiningDate).getFullYear();
      const currentYear = new Date().getFullYear();
      return {
        ...emp,
        yearsCompleted: currentYear - joinYear,
      };
    });

  // Filter birthdays in current / next month
  const upcomingBirthdays = allEmployees
    .filter((emp) => {
      if (!emp.dateOfBirth) return false;
      const m = new Date(emp.dateOfBirth).getMonth() + 1;
      return m === currentMonth || m === nextMonth;
    })
    .slice(0, 5);

  return {
    recentHires,
    recentlyAdded,
    upcomingAnniversaries,
    upcomingBirthdays,
  };
}

/**
 * Get HR specific metrics like Attendance Summary and Average Working Hours.
 */
export async function getHrMetrics(filter = {}) {
  const attendanceAgg = await Attendance.aggregate([
    {
      $group: {
        _id: null,
        totalHours: { $sum: '$totalHoursWorked' },
        totalOvertime: { $sum: '$overtimeHours' },
        count: { $sum: 1 },
        presentCount: { $sum: { $cond: [{ $eq: ['$attendanceStatus', 'PRESENT'] }, 1, 0] } }
      }
    }
  ]);
  
  const performanceAgg = await Performance.aggregate([
    {
      $group: {
        _id: null,
        avgScore: { $avg: '$performanceScore' },
        promotionCount: { $sum: { $cond: ['$promotionRecommendation', 1, 0] } }
      }
    }
  ]);
  
  const surveyAgg = await Survey.aggregate([
    {
      $group: {
        _id: null,
        avgSatisfaction: { $avg: '$jobSatisfaction' },
        avgEngagement: { $avg: '$engagementScore' },
        count: { $sum: 1 }
      }
    }
  ]);

  const trainingAgg = await TrainingHistory.aggregate([
    {
      $group: {
        _id: null,
        totalHours: { $sum: '$durationHours' },
        certificationsCount: { $sum: { $cond: ['$certificationEarned', 1, 0] } },
        count: { $sum: 1 }
      }
    }
  ]);

  const promotionAgg = await PromotionHistory.aggregate([
    {
      $group: {
        _id: null,
        avgSalaryIncrease: { $avg: '$salaryIncreasePercentage' },
        count: { $sum: 1 }
      }
    }
  ]);

  return {
    attendance: attendanceAgg[0] || { totalHours: 0, totalOvertime: 0, count: 0, presentCount: 0 },
    performance: performanceAgg[0] || { avgScore: 0, promotionCount: 0 },
    surveys: surveyAgg[0] || { avgSatisfaction: 0, avgEngagement: 0, count: 0 },
    training: trainingAgg[0] || { totalHours: 0, certificationsCount: 0, count: 0 },
    promotions: promotionAgg[0] || { avgSalaryIncrease: 0, count: 0 }
  };
}

