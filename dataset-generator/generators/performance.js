const { v4: uuidv4 } = require('uuid');
const { getRandomFloat, getRandomInt } = require('../utils/random');
const dayjs = require('dayjs');

function generate(employees) {
  const reviews = [];
  const currentYear = dayjs().year();

  employees.forEach(employee => {
    const hireYear = dayjs(employee.HireDate).year();
    
    // Generate reviews from hire year up to last year
    for (let year = hireYear + 1; year <= currentYear; year++) {
      
      // A typical 1-5 rating scale
      const rating = getRandomFloat(2.0, 5.0, 1);
      
      // Determine if promoted based on high rating and random chance
      let promoted = false;
      if (rating >= 4.5 && Math.random() > 0.6) {
        promoted = true;
      }

      reviews.push({
        ReviewID: uuidv4(),
        EmployeeID: employee.EmployeeID,
        ReviewYear: year,
        ReviewDate: `${year}-12-15`,
        PerformanceRating: rating,
        GoalsMet: getRandomInt(60, 100),
        TrainingHoursCompleted: getRandomInt(10, 60),
        PromotedThisYear: promoted
      });
    }
  });

  return reviews;
}

module.exports = { generate };
