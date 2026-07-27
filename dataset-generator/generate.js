const { createWriter } = require('./utils/csv');
const { validate } = require('./utils/validation');

const generateDepartments = require('./generators/departments').generate;
const generateEmployees = require('./generators/employees').generate;
const generateAttendance = require('./generators/attendance').generate;
const generatePerformance = require('./generators/performance').generate;
const generateSurveys = require('./generators/surveys').generate;
const generateFeedback = require('./generators/feedback').generate;
const generateManagerNotes = require('./generators/managerNotes').generate;

async function run() {
  console.log('Starting Dataset Generation for RetentionAI...\n');

  try {
    // 1. Departments
    console.log('Generating Departments...');
    const departments = generateDepartments();
    const deptWriter = createWriter('departments.csv', ['DepartmentID', 'Name', 'Code', 'Description', 'Location', 'IsActive']);
    await deptWriter.writeRecords(departments);
    console.log(`\u2713 Saved ${departments.length} departments.\n`);

    // 2. Employees
    console.log('Generating Employees (Target: 1470)...');
    const employees = generateEmployees(departments);
    const empWriter = createWriter('employees.csv', [
      'EmployeeID', 'FirstName', 'LastName', 'Email', 'DepartmentID', 'ManagerID', 
      'JobRole', 'HireDate', 'Status', 'MonthlySalaryINR', 'WorkLocation', 
      'Gender', 'Age', 'DistanceFromHomeKM', 'EducationLevel'
    ]);
    await empWriter.writeRecords(employees);
    console.log(`\u2713 Saved ${employees.length} employees.\n`);

    // 3. Attendance
    console.log('Generating Attendance records...');
    const attendance = generateAttendance(employees);
    const attWriter = createWriter('attendance.csv', ['RecordID', 'EmployeeID', 'Month', 'DaysAbsent', 'DaysPresent', 'OvertimeHours', 'RemoteDays']);
    await attWriter.writeRecords(attendance);
    console.log(`\u2713 Saved ${attendance.length} attendance records.\n`);

    // 4. Performance
    console.log('Generating Performance Reviews...');
    const performance = generatePerformance(employees);
    const perfWriter = createWriter('performance_reviews.csv', ['ReviewID', 'EmployeeID', 'ReviewYear', 'ReviewDate', 'PerformanceRating', 'GoalsMet', 'TrainingHoursCompleted', 'PromotedThisYear']);
    await perfWriter.writeRecords(performance);
    console.log(`\u2713 Saved ${performance.length} performance records.\n`);

    // 5. Surveys
    console.log('Generating Employee Surveys...');
    const surveys = generateSurveys(employees);
    const surveyWriter = createWriter('employee_surveys.csv', ['SurveyID', 'EmployeeID', 'SurveyDate', 'EngagementScore', 'JobSatisfaction', 'WorkLifeBalance']);
    await surveyWriter.writeRecords(surveys);
    console.log(`\u2713 Saved ${surveys.length} survey records.\n`);

    // 6. Feedback
    console.log('Generating Employee Feedback...');
    const feedback = generateFeedback(employees);
    const feedbackWriter = createWriter('employee_feedback.csv', ['FeedbackID', 'EmployeeID', 'Date', 'FeedbackText', 'Sentiment']);
    await feedbackWriter.writeRecords(feedback);
    console.log(`\u2713 Saved ${feedback.length} feedback records.\n`);

    // 7. Manager Notes
    console.log('Generating Manager Notes...');
    const managerNotes = generateManagerNotes(employees);
    const notesWriter = createWriter('manager_notes.csv', ['NoteID', 'EmployeeID', 'ManagerID', 'Date', 'NoteText']);
    await notesWriter.writeRecords(managerNotes);
    console.log(`\u2713 Saved ${managerNotes.length} manager notes.\n`);

    console.log('Running Post-Generation Validation...');
    const isValid = validate(employees, attendance, performance, surveys, feedback, managerNotes);

    if (isValid) {
      console.log('\n\u2728 All datasets generated and validated successfully!');
      console.log('Outputs are available in the /output directory.');
    } else {
      console.log('\n\u26a0\ufe0f Datasets generated but failed validation. Check errors above.');
    }

  } catch (error) {
    console.error('\n\u274c Fatal Error during generation:', error);
  }
}

run();
