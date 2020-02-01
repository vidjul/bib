const fs = require('fs').promises;

/**
 * REQUEST HELPERS
 */

/**
 * Pause code execution for an amount of time
 * @param {Number} ms Number of ms to wait
 */
const sleep = ms => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Clean a given text by removing white spaces and line breaks
 * @param {String} text text to clean
 */
const cleanText = text => {
  if (!text) {
    return;
  }
  return text
    .trim()
    .replace(/^s+/gm, '')
    .replace(/\n/gm, '')
    .replace(/\s{2,}/gm, '');
};

/**
 *
 * @param {Object|Array} elem elem with fields to be cleaned
 */
const cleanElem = elem => {
  if (Array.isArray(elem)) {
    return elem.map(value => cleanText(value));
  } else {
    const res = {};
    Object.entries(elem).forEach(entry => {
      res[entry[0]] = cleanText(entry[1]);
    });
    return res;
  }
};

const writeJSON = async (fileName, obj) => {
  await fs.writeFile(
    `./server/output/${fileName}.json`,
    JSON.stringify(obj, null, 2)
  );
};

module.exports = { cleanText, cleanElem, sleep, writeJSON };
