/**
 * seedDemoData.js
 * ---------------
 * Seeds the running Mongoose connection with CSV data from the dataset-generator.
 * Called during server startup if the DB is empty (in-memory or fresh local).
 *
 * Import and call `seedDemoData()` only AFTER `connectDatabase()` has resolved.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { parse } from 'csv-parse/sync';

import { Department } from '../models/Department.js';
import { Employee } from '../models/Employee.js';
import { Attendance } from '../models/Attendance.js';
import { Performance } from '../models/Performance.js';
import { Survey } from '../models/Survey.js';
import { EmployeeFeedback } from '../models/EmployeeFeedback.js';
import { ManagerNote } from '../models/ManagerNote.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATASET_DIR = path.join(__dirname, '../../../dataset-generator/output');
const ORG_ID = new mongoose.Types.ObjectId('60d5ec388832a828f8000000');

function readCSV(filename) {
  const filePath = path.join(DATASET_DIR, filename);
  if (!fs.existsSync(filePath)) {
    console.warn(`[seed] CSV not found, skipping: ${filePath}`);
    return null;
  }
  return parse(fs.readFileSync(filePath, 'utf8'), { columns: true, skip_empty_lines: true });
}

export async function seedDemoData() {
  // Only seed if the DB is empty
  const existingCount = await Employee.countDocuments();
  if (existingCount > 0) {
    console.log(`[seed] ${existingCount} employees already in DB, skipping seed.`);
    return;
  }

  const deptRaw = readCSV('departments.csv');
  if (!deptRaw) {
    console.warn('[seed] Dataset CSVs not found. Skipping HR seed. Run the dataset-generator first.');
    return;
  }

  console.log('[seed] Seeding HR demo data into running DB...');
  const deptMap = new Map();
  const empMap = new Map();

  // 1. Departments
  const depts = deptRaw.map(d => {
    const id = new mongoose.Types.ObjectId();
    deptMap.set(d.DepartmentID, id);
    return {
      _id: id,
      organizationId: ORG_ID,
      name: d.Name,
      code: d.Code,
      description: d.Description,
      location: d.Location,
      isActive: d.IsActive === 'true',
    };
  });
  await Department.insertMany(depts, { ordered: false });
  console.log(`[seed]   ✓ ${depts.length} departments`);

  // 2. Employees
  const empRaw = readCSV('employees.csv');
  if (!empRaw) return;
  const fallbackDeptId = depts[0]._id;
  const genderMap = { Male: 'MALE', Female: 'FEMALE', 'Non-Binary': 'OTHER' };
  empRaw.forEach(e => empMap.set(e.EmployeeID, new mongoose.Types.ObjectId()));

  const employees = empRaw.map((e, i) => ({
    _id: empMap.get(e.EmployeeID),
    organizationId: ORG_ID,
    employeeCode: `EMP-${(i + 1).toString().padStart(4, '0')}`,
    firstName: e.FirstName,
    lastName: e.LastName,
    email: e.Email,
    departmentId: deptMap.get(e.DepartmentID) || fallbackDeptId,
    managerId: e.ManagerID ? (empMap.get(e.ManagerID) || null) : null,
    designation: e.JobRole,
    joiningDate: new Date(e.HireDate),
    salary: parseFloat(e.MonthlySalaryINR) * 12,
    workLocation: e.WorkLocation,
    gender: genderMap[e.Gender] || 'PREFER_NOT_TO_SAY',
    status: e.Status === 'Active' ? 'ACTIVE' : 'TERMINATED',
    employmentType: 'FULL_TIME',
  }));
  await Employee.insertMany(employees, { ordered: false });
  console.log(`[seed]   ✓ ${employees.length} employees`);

  // 3. Attendance
  const attRaw = readCSV('attendance.csv');
  if (attRaw) {
    const att = attRaw.filter(a => empMap.has(a.EmployeeID)).map(a => ({
      organizationId: ORG_ID,
      employeeId: empMap.get(a.EmployeeID),
      attendanceDate: new Date(`${a.Month}-01`),
      attendanceStatus: parseInt(a.DaysAbsent) > 0 ? 'ABSENT' : 'PRESENT',
      totalHoursWorked: parseInt(a.DaysPresent) * 8,
      overtimeHours: parseFloat(a.OvertimeHours) || 0,
      workMode: parseInt(a.RemoteDays) > 5 ? 'REMOTE' : 'OFFICE',
    }));
    await Attendance.insertMany(att, { ordered: false });
    console.log(`[seed]   ✓ ${att.length} attendance records`);
  }

  // 4. Performance
  const perfRaw = readCSV('performance_reviews.csv');
  if (perfRaw) {
    const seen = new Set();
    const perf = perfRaw.filter(p => {
      const key = `${p.EmployeeID}_${p.ReviewYear}`;
      if (seen.has(key) || !empMap.has(p.EmployeeID)) return false;
      seen.add(key);
      return true;
    }).map(p => ({
      organizationId: ORG_ID,
      employeeId: empMap.get(p.EmployeeID),
      reviewPeriod: `Annual ${p.ReviewYear}`,
      reviewerId: empMap.get(p.EmployeeID),
      performanceScore: Math.min(5, Math.max(1, Math.round(parseFloat(p.PerformanceRating)))),
      goalAchievement: parseInt(p.GoalsMet) || 75,
      promotionRecommendation: p.PromotedThisYear === 'true',
    }));
    await Performance.insertMany(perf, { ordered: false });
    console.log(`[seed]   ✓ ${perf.length} performance reviews`);
  }

  // 5. Surveys
  const surveyRaw = readCSV('employee_surveys.csv');
  if (surveyRaw) {
    const surveys = surveyRaw.filter(s => empMap.has(s.EmployeeID)).map(s => ({
      organizationId: ORG_ID,
      employeeId: empMap.get(s.EmployeeID),
      surveyDate: new Date(s.SurveyDate),
      engagementScore: parseInt(s.EngagementScore) || 3,
      jobSatisfaction: parseInt(s.JobSatisfaction) || 3,
      workLifeBalance: parseInt(s.WorkLifeBalance) || 3,
      stressLevel: 3,
      careerGrowthScore: parseInt(s.JobSatisfaction) || 3,
      managerRelationshipScore: parseInt(s.EngagementScore) || 3,
    }));
    await Survey.insertMany(surveys, { ordered: false });
    console.log(`[seed]   ✓ ${surveys.length} surveys`);
  }

  // 6. Feedback
  const feedbackRaw = readCSV('employee_feedback.csv');
  if (feedbackRaw) {
    const feedback = feedbackRaw.filter(f => empMap.has(f.EmployeeID)).map(f => ({
      organizationId: ORG_ID,
      employeeId: empMap.get(f.EmployeeID),
      feedbackDate: new Date(f.Date),
      feedbackText: f.FeedbackText,
      category: 'OTHER',
      anonymous: false,
      visibility: 'HR_ONLY',
    }));
    await EmployeeFeedback.insertMany(feedback, { ordered: false });
    console.log(`[seed]   ✓ ${feedback.length} feedback records`);
  }

  // 7. Manager Notes
  const notesRaw = readCSV('manager_notes.csv');
  if (notesRaw) {
    const notes = notesRaw.filter(n => empMap.has(n.EmployeeID) && empMap.has(n.ManagerID)).map(n => ({
      organizationId: ORG_ID,
      employeeId: empMap.get(n.EmployeeID),
      managerId: empMap.get(n.ManagerID),
      noteDate: new Date(n.Date),
      observation: n.NoteText,
    }));
    await ManagerNote.insertMany(notes, { ordered: false });
    console.log(`[seed]   ✓ ${notes.length} manager notes`);
  }

  console.log('[seed] ✨ HR demo data seeded successfully!');
}
