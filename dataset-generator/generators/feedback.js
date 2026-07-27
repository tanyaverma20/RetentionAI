const { v4: uuidv4 } = require('uuid');
const { getRandomItem } = require('../utils/random');
const dayjs = require('dayjs');
const { generateDateBetween } = require('../utils/dates');

const feedbackSamples = [
  "I feel that I need more challenging projects to grow.",
  "The current management style is very supportive.",
  "We need better tools to handle the increased workload.",
  "Communication between departments could be improved.",
  "I am very happy with the recent changes in remote work policy.",
  "I feel overlooked for promotions despite my hard work.",
  "Great team environment, love working here.",
  "The benefits package is competitive but could improve on health coverage.",
  "Sometimes I feel micromanaged by leadership.",
  "I appreciate the continuous learning opportunities provided."
];

const sentimentMapping = {
  "I feel that I need more challenging projects to grow.": "Neutral",
  "The current management style is very supportive.": "Positive",
  "We need better tools to handle the increased workload.": "Negative",
  "Communication between departments could be improved.": "Negative",
  "I am very happy with the recent changes in remote work policy.": "Positive",
  "I feel overlooked for promotions despite my hard work.": "Negative",
  "Great team environment, love working here.": "Positive",
  "The benefits package is competitive but could improve on health coverage.": "Neutral",
  "Sometimes I feel micromanaged by leadership.": "Negative",
  "I appreciate the continuous learning opportunities provided.": "Positive"
};

function generate(employees) {
  const feedbacks = [];

  // Not everyone gives written feedback
  const feedbackGivers = employees.filter(() => Math.random() > 0.4);

  feedbackGivers.forEach(employee => {
    // Generate 1-3 pieces of feedback per employee
    const numFeedbacks = Math.floor(Math.random() * 3) + 1;
    
    for (let i = 0; i < numFeedbacks; i++) {
      const text = getRandomItem(feedbackSamples);
      const sentiment = sentimentMapping[text];
      const date = generateDateBetween(employee.HireDate, dayjs().format('YYYY-MM-DD'));

      feedbacks.push({
        FeedbackID: uuidv4(),
        EmployeeID: employee.EmployeeID,
        Date: date,
        FeedbackText: text,
        Sentiment: sentiment
      });
    }
  });

  return feedbacks;
}

module.exports = { generate };
