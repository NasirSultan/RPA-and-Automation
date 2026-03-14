

require('dotenv').config();

const express  = require('express');
const cors     = require('cors');
const morgan   = require('morgan');
const path     = require('path');
const fs       = require('fs');
const { crawl }           = require('./crawler');
const { startScheduler }  = require('./scheduler');
const logger              = require('./logger');

const app  = express();
const PORT = process.env.PORT || 3003;

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));
app.use(express.static(path.join(__dirname, '../public')));


app.use('/data', express.static(path.resolve('./data')));


app.get('/health', (req, res) => {
  res.json({
    status:    'ok',
    timestamp: new Date().toISOString(),
    uptime:    process.uptime(),
    platform:  process.platform,
    node:      process.version,
  });
});



app.post('/api/crawl', async (req, res) => {
  let { urls, downloadImages = false } = req.body;


  if (!urls || urls.length === 0) {
    urls = (process.env.TARGET_URLS || '').split(',').map(u => u.trim()).filter(Boolean);
  }

  if (!urls || urls.length === 0) {
    return res.status(400).json({ error: 'Provide urls array or set TARGET_URLS in .env' });
  }

  logger.info(`API crawl request: ${urls.length} URL(s)`);

  try {
    const result = await crawl(urls, { downloadImgs: downloadImages });
    res.json(result);
  } catch (err) {
    logger.error(`API crawl error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});


app.get('/api/results', (req, res) => {
  const jsonDir = path.resolve(process.env.JSON_DIR || './data/json');
  const csvDir  = path.resolve(process.env.CSV_DIR  || './data/csv');

  const json = fs.existsSync(jsonDir)
    ? fs.readdirSync(jsonDir).filter(f => f.endsWith('.json'))
        .map(f => {
          const stat = fs.statSync(path.join(jsonDir, f));
          return { file: f, url: `/data/json/${f}`, sizeKB: (stat.size / 1024).toFixed(1), createdAt: stat.birthtime };
        })
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    : [];

  const csv = fs.existsSync(csvDir)
    ? fs.readdirSync(csvDir).filter(f => f.endsWith('.csv'))
        .map(f => {
          const stat = fs.statSync(path.join(csvDir, f));
          return { file: f, url: `/data/csv/${f}`, sizeKB: (stat.size / 1024).toFixed(1), createdAt: stat.birthtime };
        })
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    : [];

  res.json({ json, csv });
});


app.get('/api/logs', (req, res) => {
  const logDir = path.resolve(process.env.LOG_DIR || './data/logs');
  const lines  = parseInt(req.query.lines || '100');

  try {
    const files = fs.readdirSync(logDir)
      .filter(f => f.startsWith('crawler-') && f.endsWith('.log'))
      .sort().reverse();

    if (files.length === 0) return res.json({ logs: [] });

    const content = fs.readFileSync(path.join(logDir, files[0]), 'utf8');
    const logLines = content.trim().split('\n').slice(-lines);
    res.json({ file: files[0], lines: logLines });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


app.listen(PORT, () => {
  logger.info(`Linux Crawler API → http://localhost:${PORT}`);
  logger.info(`Platform: ${process.platform} | Node: ${process.version}`);
  startScheduler();
});

module.exports = app;
