const { v4: uuidv4 } = require('uuid');
const { getRandomInt, getWeightedItem } = require('../utils/random');
const dayjs = require('dayjs');

function generate(employees) {
  const surveys = [];
  const surveyDates = ['2023-06-01', '2023-12-01', '2024-06-01'];

  employees.forEach(employee => {
    surveyDates.forEach(date => {
      // Ensure they were hired before the survey
      if (dayjs(employee.HireDate).isBefore(dayjs(date))) {
        
        // Randomly simulate whether they took the survey
        if (Math.random() > 0.15) {
          // Adjust satisfaction based on salary and distance (simple heuristics)
          let baseScore = 3;
          if (employee.MonthlySalaryINR > 100000) baseScore += 1;
          if (employee.DistanceFromHomeKM > 20) baseScore -= 1;
          
          const engagement = Math.max(1, Math.min(5, baseScore + getRandomInt(-1, 1)));
          const satisfaction = Math.max(1, Math.min(5, baseScore + getRandomInt(-1, 1)));
          const workLife = Math.max(1, Math.min(5, baseScore + getRandomInt(-2, 1)));

          surveys.push({
            SurveyID: uuidv4(),
            EmployeeID: employee.EmployeeID,
            SurveyDate: date,
            EngagementScore: engagement,
            JobSatisfaction: satisfaction,
            WorkLifeBalance: workLife
          });
        }
      }
    });
  });

  return surveys;
}

module.exports = { generate };
