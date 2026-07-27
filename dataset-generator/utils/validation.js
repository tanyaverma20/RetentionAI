function validate(employees, attendance, performance, surveys, feedback, managerNotes) {
  let errors = 0;

  const validEmployeeIds = new Set(employees.map(e => e.EmployeeID));

  if (validEmployeeIds.size !== 1470) {
    console.error(`Validation Error: Expected 1470 unique employees, found ${validEmployeeIds.size}`);
    errors++;
  } else {
    console.log(`\u2713 Exactly 1470 unique EmployeeIDs found.`);
  }

  // Check attendance references
  const invalidAttendance = attendance.filter(a => !validEmployeeIds.has(a.EmployeeID));
  if (invalidAttendance.length > 0) {
    console.error(`Validation Error: Found ${invalidAttendance.length} attendance records with invalid EmployeeIDs`);
    errors++;
  }

  // Check performance references
  const invalidPerformance = performance.filter(p => !validEmployeeIds.has(p.EmployeeID));
  if (invalidPerformance.length > 0) {
    console.error(`Validation Error: Found ${invalidPerformance.length} performance records with invalid EmployeeIDs`);
    errors++;
  }

  // Check surveys references
  const invalidSurveys = surveys.filter(s => !validEmployeeIds.has(s.EmployeeID));
  if (invalidSurveys.length > 0) {
    console.error(`Validation Error: Found ${invalidSurveys.length} survey records with invalid EmployeeIDs`);
    errors++;
  }

  // Check feedback references
  const invalidFeedback = feedback.filter(f => !validEmployeeIds.has(f.EmployeeID));
  if (invalidFeedback.length > 0) {
    console.error(`Validation Error: Found ${invalidFeedback.length} feedback records with invalid EmployeeIDs`);
    errors++;
  }

  // Check manager notes references
  const invalidNotesEmp = managerNotes.filter(n => !validEmployeeIds.has(n.EmployeeID));
  const invalidNotesMgr = managerNotes.filter(n => !validEmployeeIds.has(n.ManagerID));
  if (invalidNotesEmp.length > 0 || invalidNotesMgr.length > 0) {
    console.error(`Validation Error: Found manager notes with invalid references (Emp: ${invalidNotesEmp.length}, Mgr: ${invalidNotesMgr.length})`);
    errors++;
  }

  if (errors === 0) {
    console.log(`\u2713 Referential integrity check passed. No broken references.`);
  } else {
    console.error(`\u274c Validation failed with ${errors} errors.`);
  }

  return errors === 0;
}

module.exports = { validate };
