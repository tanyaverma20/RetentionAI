import { Employee } from '../models/Employee.js';
import { Department } from '../models/Department.js';
import { Attendance } from '../models/Attendance.js';
import { Performance } from '../models/Performance.js';
import { TrainingHistory } from '../models/TrainingHistory.js';
import { PromotionHistory } from '../models/PromotionHistory.js';
import { AppError } from '../errors/AppError.js';
import { parse } from 'json2csv';
import { recordAudit } from '../services/auditService.js';
import { logger } from '../utils/logger.js';


/**
 * Helper function to send CSV response
 */
function sendCsvResponse(response, data, filename, request) {
  if (!data || data.length === 0) {
    return response.status(404).json({ success: false, message: 'No records found to export' });
  }

  try {
    const csv = parse(data);
    if (request?.auth?.userId) {
      recordAudit(request.auth.organizationId, 'REPORT_EXPORTED', request.auth.userId, { context: { report: filename } });
    }
    logger.info('report_exported', { report: filename, rowCount: data.length, userId: request?.auth?.userId });
    response.header('Content-Type', 'text/csv');
    response.attachment(`${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    return response.send(csv);
  } catch (error) {
    logger.error('report_export_failed', { report: filename, message: error.message });
    throw new AppError(500, 'EXPORT_FAILED', 'Failed to generate CSV export');
  }
}

export async function exportEmployeeSummary(request, response, next) {
  try {
    const employees = await Employee.find({ isDeleted: false })
      .populate('departmentId', 'name code')
      .lean();

    const data = employees.map((emp) => ({
      EmployeeID: emp.employeeCode,
      FirstName: emp.firstName,
      LastName: emp.lastName,
      Email: emp.email,
      Department: emp.departmentId ? emp.departmentId.name : 'Unassigned',
      Designation: emp.designation,
      Status: emp.status,
      JoiningDate: emp.joiningDate ? new Date(emp.joiningDate).toISOString().split('T')[0] : '',
      EmploymentType: emp.employmentType,
    }));

    return sendCsvResponse(response, data, 'Employee_Summary', request);
  } catch (error) {
    return next(error);
  }
}

export async function exportDepartmentSummary(request, response, next) {
  try {
    const departments = await Department.find({ isActive: true })
      .populate('managerId', 'firstName lastName')
      .lean();

    const data = await Promise.all(departments.map(async (dept) => {
      const empCount = await Employee.countDocuments({ departmentId: dept._id, isDeleted: false });
      return {
        DepartmentCode: dept.code,
        DepartmentName: dept.name,
        Location: dept.location,
        Manager: dept.managerId ? `${dept.managerId.firstName} ${dept.managerId.lastName}` : 'None',
        Headcount: empCount,
      };
    }));

    return sendCsvResponse(response, data, 'Department_Summary', request);
  } catch (error) {
    return next(error);
  }
}

export async function exportAttendanceReport(request, response, next) {
  try {
    const records = await Attendance.find()
      .populate('employeeId', 'firstName lastName employeeCode')
      .limit(1000) // Limit for large exports without pagination
      .lean();

    const data = records.map((rec) => ({
      EmployeeCode: rec.employeeId?.employeeCode,
      Name: `${rec.employeeId?.firstName} ${rec.employeeId?.lastName}`,
      Date: rec.attendanceDate ? new Date(rec.attendanceDate).toISOString().split('T')[0] : '',
      Status: rec.attendanceStatus,
      TotalHours: rec.totalHoursWorked,
      Overtime: rec.overtimeHours,
      WorkMode: rec.workMode,
      LeaveType: rec.leaveType,
    }));

    return sendCsvResponse(response, data, 'Attendance_Report', request);
  } catch (error) {
    return next(error);
  }
}

export async function exportPerformanceReport(request, response, next) {
  try {
    const records = await Performance.find()
      .populate('employeeId', 'firstName lastName employeeCode')
      .lean();

    const data = records.map((rec) => ({
      EmployeeCode: rec.employeeId?.employeeCode,
      Name: `${rec.employeeId?.firstName} ${rec.employeeId?.lastName}`,
      ReviewPeriod: rec.reviewPeriod,
      PerformanceScore: rec.performanceScore,
      GoalAchievement: rec.goalAchievement,
      PromotionRecommended: rec.promotionRecommendation ? 'Yes' : 'No',
    }));

    return sendCsvResponse(response, data, 'Performance_Report', request);
  } catch (error) {
    return next(error);
  }
}

export async function exportTrainingReport(request, response, next) {
  try {
    const records = await TrainingHistory.find()
      .populate('employeeId', 'firstName lastName employeeCode')
      .lean();

    const data = records.map((rec) => ({
      EmployeeCode: rec.employeeId?.employeeCode,
      Name: `${rec.employeeId?.firstName} ${rec.employeeId?.lastName}`,
      CourseName: rec.courseName,
      Provider: rec.provider,
      CompletionDate: rec.completionDate ? new Date(rec.completionDate).toISOString().split('T')[0] : '',
      DurationHours: rec.durationHours,
      CertificationEarned: rec.certificationEarned ? 'Yes' : 'No',
      Score: rec.score,
    }));

    return sendCsvResponse(response, data, 'Training_Report', request);
  } catch (error) {
    return next(error);
  }
}

export async function exportPromotionReport(request, response, next) {
  try {
    const records = await PromotionHistory.find()
      .populate('employeeId', 'firstName lastName employeeCode')
      .lean();

    const data = records.map((rec) => ({
      EmployeeCode: rec.employeeId?.employeeCode,
      Name: `${rec.employeeId?.firstName} ${rec.employeeId?.lastName}`,
      PreviousRole: rec.previousRole,
      NewRole: rec.newRole,
      PromotionDate: rec.promotionDate ? new Date(rec.promotionDate).toISOString().split('T')[0] : '',
      SalaryIncreasePercent: rec.salaryIncreasePercentage,
    }));

    return sendCsvResponse(response, data, 'Promotion_Report', request);
  } catch (error) {
    return next(error);
  }
}
