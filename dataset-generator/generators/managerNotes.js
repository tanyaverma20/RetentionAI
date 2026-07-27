const { v4: uuidv4 } = require('uuid');
const { getRandomItem } = require('../utils/random');
const dayjs = require('dayjs');
const { generateDateBetween } = require('../utils/dates');

const notesSamples = [
  "Employee is showing great leadership potential.",
  "Needs to work on communication skills with cross-functional teams.",
  "Consistent performer, always meets deadlines.",
  "Struggling with the new tech stack, suggested additional training.",
  "Going through some personal issues, performance slightly dipped but expected to recover.",
  "Highly motivated, took initiative on the last project.",
  "Frequently arrives late to meetings, need to address punctuality.",
  "Great team player, always willing to help peers.",
  "Has expressed interest in moving to a management role.",
  "Requires too much supervision for senior-level tasks."
];

function generate(employees) {
  const notes = [];

  // Managers leave notes for their direct reports
  const employeesWithManagers = employees.filter(e => e.ManagerID !== null && e.ManagerID !== '');

  employeesWithManagers.forEach(employee => {
    // Random chance to have notes
    if (Math.random() > 0.5) {
      const numNotes = Math.floor(Math.random() * 2) + 1; // 1 to 2 notes
      
      for (let i = 0; i < numNotes; i++) {
        const text = getRandomItem(notesSamples);
        const date = generateDateBetween(employee.HireDate, dayjs().format('YYYY-MM-DD'));

        notes.push({
          NoteID: uuidv4(),
          EmployeeID: employee.EmployeeID,
          ManagerID: employee.ManagerID,
          Date: date,
          NoteText: text
        });
      }
    }
  });

  return notes;
}

module.exports = { generate };
