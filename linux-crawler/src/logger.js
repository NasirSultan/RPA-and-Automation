require('dotenv').config();
const { createLogger, format, transports } = require('winston');
require('winston-daily-rotate-file');
const path = require('path');
const fs   = require('fs');

const LOG_DIR = path.resolve(process.env.LOG_DIR || './data/logs');
fs.mkdirSync(LOG_DIR, { recursive: true });

const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    format.printf(({ timestamp, level, message, stack }) =>
      stack
        ? `[${timestamp}] ${level.toUpperCase()}: ${message}\n${stack}`
        : `[${timestamp}] ${level.toUpperCase()}: ${message}`
    )
  ),
  transports: [
    // Console — coloured
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.printf(({ timestamp, level, message }) =>
          `[${timestamp}] ${level}: ${message}`
        )
      ),
    }),

    new transports.DailyRotateFile({
      filename:     path.join(LOG_DIR, 'crawler-%DATE%.log'),
      datePattern:  'YYYY-MM-DD',
      maxSize:      '20m',
      maxFiles:     '14d',
      zippedArchive: true,
    }),
   
    new transports.DailyRotateFile({
      filename:    path.join(LOG_DIR, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level:       'error',
      maxFiles:    '14d',
    }),
  ],
});

module.exports = logger;
