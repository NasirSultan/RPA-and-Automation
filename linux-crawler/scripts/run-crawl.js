#!/usr/bin/env node
/**
 * Standalone CLI crawler — run without the server
 * Usage:
 *   node scripts/run-crawl.js
 *   node scripts/run-crawl.js https://example.com https://quotes.toscrape.com
 *
 * Can also be called directly from a Linux crontab:
 *   0 0 * * * /usr/bin/node /home/user/linux-crawler/scripts/run-crawl.js >> /home/user/linux-crawler/data/logs/cron.log 2>&1
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const { crawl } = require('../src/crawler');
const logger    = require('../src/logger');

async function main() {
  // URLs from CLI args or fall back to .env
  let urls = process.argv.slice(2);

  if (urls.length === 0) {
    urls = (process.env.TARGET_URLS || '').split(',').map(u => u.trim()).filter(Boolean);
  }

  if (urls.length === 0) {
    console.error('ERROR: No URLs provided. Pass URLs as arguments or set TARGET_URLS in .env');
    process.exit(1);
  }

  logger.info(`CLI Crawl starting — ${urls.length} URL(s): ${urls.join(', ')}`);

  try {
    const result = await crawl(urls, { downloadImgs: false });

    console.log('\n========= CRAWL SUMMARY =========');
    console.log(`Total URLs  : ${result.totalUrls}`);
    console.log(`Succeeded   : ${result.succeeded}`);
    console.log(`Failed      : ${result.failed}`);
    console.log(`Time        : ${result.elapsedSec}s`);
    console.log(`JSON output : ${result.outputs.json}`);
    console.log(`CSV output  : ${result.outputs.csv}`);
    if (result.errors.length > 0) {
      console.log('\nErrors:');
      result.errors.forEach(e => console.log(`  - ${e.url}: ${e.error}`));
    }
    console.log('=================================\n');

    process.exit(0);
  } catch (err) {
    logger.error(`CLI crawl failed: ${err.message}`);
    process.exit(1);
  }
}

main();
