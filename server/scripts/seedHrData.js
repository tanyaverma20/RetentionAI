import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { parse } from 'csv-parse/sync';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { fileURLToPath } from 'url';

import { Department } from '../src/models/Department.js';
import { Employee } from '../src/models/Employee.js';
import { Attendance } from '../src/models/Attendance.js';
import { Performance } from '../src/models/Performance.js';
import { Survey } from '../src/models/Survey.js';
import { EmployeeFeedback } from '../src/models/EmployeeFeedback.js';
import { ManagerNote } from '../src/models/ManagerNote.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATASET_DIR = path.join(__dirname, '../../dataset-generator/output');
const ORG_ID = new mongoose.Types.ObjectId('60d5ec388832a828f8000000');

function readCSV(filename) {
  const filePath = path.join(DATASET_DIR, filename);
  if (!fs.existsSync(filePath)) {
    throw new Error(`CSV file not found: ${filePath}`);
  }
  const content = fs.readFileSync(filePath, 'utf8');
  return parse(content, { columns: true, skip_empty_lines: true });
}

async function seedData() {
  console.log('Starting standalone in-memory MongoDB for seeding...');
  const mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();

  await mongoose.connect(uri, { dbName: 'retentionai_seed' });
  console.log(`Connected to in-memory MongoDB at ${uri}\n`);

  const deptMap = new Map();
  const empMap = new Map();

  // 1. Departments
  console.log('Seeding departments...');
  const deptData = readCSV('departments.csv');
  const departmentsToInsert = deptData.map(d => {
    const objId = new mongoose.Types.ObjectId();
    deptMap.set(d.DepartmentID, objId);
    return {
      _id: objId,
      organizationId: ORG_ID,
      name: d.Name,
      code: d.Code,
      description: d.Description,
      location: d.Location,
      isActive: d.IsActive === 'true',
    };
  });
  await Department.insertMany(departmentsToInsert);
  console.log(`  ✓ ${departmentsToInsert.length} departments`);

  // 2. Employees
  console.log('Seeding employees...');
  const empData = readCSV('employees.csv');
  empData.forEach(e => empMap.set(e.EmployeeID, new mongoose.Types.ObjectId()));

  const genderMap = { Male: 'MALE', Female: 'FEMALE', 'Non-Binary': 'OTHER' };
  const fallbackDeptId = departmentsToInsert[0]._id;

  const employeesToInsert = empData.map((e, i) => ({
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
  await Employee.insertMany(employeesToInsert, { ordered: false });
  console.log(`  ✓ ${employeesToInsert.length} employees`);

  // 3. Attendance
  console.log('Seeding attendance...');
  const attData = readCSV('attendance.csv');
  const attendanceToInsert = attData
    .filter(a => empMap.has(a.EmployeeID))
    .map(a => ({
      organizationId: ORG_ID,
      employeeId: empMap.get(a.EmployeeID),
      attendanceDate: new Date(`${a.Month}-01`),
      attendanceStatus: parseInt(a.DaysAbsent) > 0 ? 'ABSENT' : 'PRESENT',
      totalHoursWorked: parseInt(a.DaysPresent) * 8,
      overtimeHours: parseFloat(a.OvertimeHours) || 0,
      workMode: parseInt(a.RemoteDays) > 5 ? 'REMOTE' : 'OFFICE',
    }));
  await Attendance.insertMany(attendanceToInsert, { ordered: false });
  console.log(`  ✓ ${attendanceToInsert.length} attendance records`);

  // 4. Performance
  console.log('Seeding performance reviews...');
  const perfData = readCSV('performance_reviews.csv');
  const perfSeen = new Set();
  const performanceToInsert = perfData
    .filter(p => {
      const key = `${p.EmployeeID}_${p.ReviewYear}`;
      if (perfSeen.has(key)) return false;
      perfSeen.add(key);
      return empMap.has(p.EmployeeID);
    })
    .map(p => ({
      organizationId: ORG_ID,
      employeeId: empMap.get(p.EmployeeID),
      reviewPeriod: `Annual ${p.ReviewYear}`,
      reviewerId: empMap.get(p.EmployeeID),
      performanceScore: Math.min(5, Math.max(1, Math.round(parseFloat(p.PerformanceRating)))),
      goalAchievement: parseInt(p.GoalsMet) || 75,
      promotionRecommendation: p.PromotedThisYear === 'true',
    }));
  await Performance.insertMany(performanceToInsert, { ordered: false });
  console.log(`  ✓ ${performanceToInsert.length} performance reviews`);

  // 5. Surveys
  console.log('Seeding surveys...');
  const surveyData = readCSV('employee_surveys.csv');
  const surveyToInsert = surveyData
    .filter(s => empMap.has(s.EmployeeID))
    .map(s => ({
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
  await Survey.insertMany(surveyToInsert, { ordered: false });
  console.log(`  ✓ ${surveyToInsert.length} surveys`);

  // 6. Feedback
  console.log('Seeding employee feedback...');
  const feedbackData = readCSV('employee_feedback.csv');
  const feedbackToInsert = feedbackData
    .filter(f => empMap.has(f.EmployeeID))
    .map(f => ({
      organizationId: ORG_ID,
      employeeId: empMap.get(f.EmployeeID),
      feedbackDate: new Date(f.Date),
      feedbackText: f.FeedbackText,
      category: 'OTHER',
      anonymous: false,
      visibility: 'HR_ONLY',
    }));
  await EmployeeFeedback.insertMany(feedbackToInsert, { ordered: false });
  console.log(`  ✓ ${feedbackToInsert.length} feedback records`);

  // 7. Manager Notes
  console.log('Seeding manager notes...');
  const notesData = readCSV('manager_notes.csv');
  const notesToInsert = notesData
    .filter(n => empMap.has(n.EmployeeID) && empMap.has(n.ManagerID))
    .map(n => ({
      organizationId: ORG_ID,
      employeeId: empMap.get(n.EmployeeID),
      managerId: empMap.get(n.ManagerID),
      noteDate: new Date(n.Date),
      observation: n.NoteText,
    }));
  await ManagerNote.insertMany(notesToInsert, { ordered: false });
  console.log(`  ✓ ${notesToInsert.length} manager notes`);

  // Write sample IDs for reference
  const seedResult = {
    mongoUri: uri,
    orgId: ORG_ID.toString(),
    sampleEmployeeIds: Array.from(empMap.values()).slice(0, 10).map(id => id.toString()),
    totalEmployees: employeesToInsert.length,
  };
  const resultPath = path.join(__dirname, 'seed-result.json');
  fs.writeFileSync(resultPath, JSON.stringify(seedResult, null, 2));

  console.log(`\n✨ All data seeded successfully!`);
  console.log(`Sample employee IDs written to scripts/seed-result.json`);

  await mongoose.disconnect();
  await mongoServer.stop();
  process.exit(0);
}

seedData().catch(err => {
  console.error('Fatal seeding error:', err.message);
  process.exit(1);
});
