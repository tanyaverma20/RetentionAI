const dayjs = require('dayjs');
const { getRandomInt } = require('./random');

function generateHireDate(maxYearsAgo = 10, minYearsAgo = 0) {
  const yearsAgo = getRandomInt(minYearsAgo, maxYearsAgo);
  const monthsAgo = getRandomInt(0, 11);
  const daysAgo = getRandomInt(0, 28);
  
  return dayjs().subtract(yearsAgo, 'year').subtract(monthsAgo, 'month').subtract(daysAgo, 'day').format('YYYY-MM-DD');
}

function generateDateBetween(startDate, endDate) {
  const start = dayjs(startDate).valueOf();
  const end = dayjs(endDate).valueOf();
  const randomMs = getRandomInt(start, end);
  return dayjs(randomMs).format('YYYY-MM-DD');
}

module.exports = {
  generateHireDate,
  generateDateBetween
};
