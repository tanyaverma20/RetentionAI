const { createObjectCsvWriter } = require('csv-writer');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, '..', 'output');

function createWriter(filename, headers) {
  return createObjectCsvWriter({
    path: path.join(OUTPUT_DIR, filename),
    header: headers.map(id => ({ id, title: id }))
  });
}

module.exports = {
  createWriter,
  OUTPUT_DIR
};
