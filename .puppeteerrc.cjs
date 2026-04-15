const {join} = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // Changes the cache location for Puppeteer to definitely be within the project directory
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};
