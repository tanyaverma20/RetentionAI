const { v4: uuidv4 } = require('uuid');
const { getRandomInt, getWeightedItem } = require('../utils/random');
const dayjs = require('dayjs');

function generate(employees) {
  const attendanceRecords = [];

  // Generate attendance for the last 6 months for each employee
  const monthsToGenerate = 6;
  const currentMonth = dayjs().startOf('month');

  employees.forEach(employee => {
    // If terminated long ago, we might not have recent attendance, but for simplicity we generate based on hire date
    const hireDate = dayjs(employee.HireDate);
    
    // Determine employee's general attendance behavior
    const behaviorProfile = getWeightedItem(['Good', 'Average', 'Poor'], [0.7, 0.2, 0.1]);

    for (let i = 0; i < monthsToGenerate; i++) {
      const recordMonth = currentMonth.subtract(i, 'month');
      if (recordMonth.isBefore(hireDate)) continue;

      let daysAbsent, overtimeHours;
      if (behaviorProfile === 'Good') {
        daysAbsent = getRandomInt(0, 1);
        overtimeHours = getRandomInt(5, 15);
      } else if (behaviorProfile === 'Average') {
        daysAbsent = getRandomInt(1, 3);
        overtimeHours = getRandomInt(0, 10);
      } else {
        daysAbsent = getRandomInt(2, 6);
        overtimeHours = getRandomInt(0, 5);
      }

      attendanceRecords.push({
        RecordID: uuidv4(),
        EmployeeID: employee.EmployeeID,
        Month: recordMonth.format('YYYY-MM'),
        DaysAbsent: daysAbsent,
        DaysPresent: 22 - daysAbsent, // Assuming 22 working days
        OvertimeHours: overtimeHours,
        RemoteDays: getRandomInt(0, 10)
      });
    }
  });

  return attendanceRecords;
}

module.exports = { generate };
