const { faker } = require('@faker-js/faker');

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomFloat(min, max, decimals = 2) {
  const num = Math.random() * (max - min) + min;
  return Number(num.toFixed(decimals));
}

function getRandomItem(array) {
  return array[getRandomInt(0, array.length - 1)];
}

function getWeightedItem(items, weights) {
  const totalWeight = weights.reduce((acc, weight) => acc + weight, 0);
  let random = Math.random() * totalWeight;
  for (let i = 0; i < items.length; i++) {
    if (random < weights[i]) {
      return items[i];
    }
    random -= weights[i];
  }
  return items[items.length - 1];
}

module.exports = {
  getRandomInt,
  getRandomFloat,
  getRandomItem,
  getWeightedItem
};
