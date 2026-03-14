

require('dotenv').config();
const cron   = require('node-cron');
const logger = require('./logger');
const { crawl } = require('./crawler');

const SCHEDULE = process.env.CRON_SCHEDULE || '0 0 * * *';
const ENABLED  = process.env.CRON_ENABLED !== 'false';
const URLS     = (process.env.TARGET_URLS || '').split(',').map(u => u.trim()).filter(Boolean);

function startScheduler() {
  if (!ENABLED) {
    logger.info('Cron scheduler disabled (CRON_ENABLED=false)');
    return null;
  }

  if (!cron.validate(SCHEDULE)) {
    logger.error(`Invalid cron schedule: "${SCHEDULE}"`);
    return null;
  }

  logger.info(`⏰ Cron scheduler started — schedule: "${SCHEDULE}"`);
  logger.info(`   Targets: ${URLS.join(', ')}`);

  const job = cron.schedule(SCHEDULE, async () => {
    logger.info('⏰ Cron job triggered — starting scheduled crawl...');
    try {
      const result = await crawl(URLS);
      logger.info(`⏰ Scheduled crawl done: ${result.succeeded}/${result.totalUrls} in ${result.elapsedSec}s`);
    } catch (err) {
      logger.error(`⏰ Scheduled crawl failed: ${err.message}`);
    }
  }, {
    scheduled: true,
   timezone: 'Asia/Karachi'   // adjust as needed
  });

  return job;
}

module.exports = { startScheduler };
