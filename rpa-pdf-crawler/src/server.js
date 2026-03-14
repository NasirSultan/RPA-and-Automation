

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const { crawlForPDFs } = require('./crawler');
const logger = require('./logger');

const app = express();
const PORT = process.env.PORT || 3000;
const DOWNLOAD_DIR = path.resolve(process.env.DOWNLOAD_DIR || './downloads');


app.use(cors());
app.use(express.json());
app.use(morgan('dev'));
app.use(express.static(path.join(__dirname, '../public')));


app.use('/downloads', express.static(DOWNLOAD_DIR));


app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    downloadDir: DOWNLOAD_DIR,
  });
});


app.post('/api/crawl', async (req, res) => {
  const { address = '', targetUrl, headless } = req.body;

  if (!address && !targetUrl) {
    return res.status(400).json({
      error: 'Provide at least an address or targetUrl to crawl',
    });
  }

  logger.info(`Crawl request: address="${address}", target="${targetUrl}"`);

  try {
    const result = await crawlForPDFs({
      address,
      targetUrl,
      headless: headless !== false,
    });

    const perfStatus =
      result.timing.total <= 8000
        ? ' STRETCH GOAL MET (≤8s)'
        : result.timing.total <= 16000
        ? 'TARGET MET (≤16s)'
        : ' OVER TARGET';

    res.json({
      ...result,
      performance: {
        totalMs: result.timing.total,
        status: perfStatus,
        targetMs: 16000,
        stretchMs: 8000,
      },
    });
  } catch (err) {
    logger.error(`Crawl endpoint error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/downloads', (req, res) => {
  try {
    const files = fs.readdirSync(DOWNLOAD_DIR)
      .filter((f) => f.toLowerCase().endsWith('.pdf'))
      .map((f) => {
        const filepath = path.join(DOWNLOAD_DIR, f);
        const stats = fs.statSync(filepath);
        return {
          filename: f,
          url: `/downloads/${encodeURIComponent(f)}`,
          size: stats.size,
          sizeKB: (stats.size / 1024).toFixed(1),
          createdAt: stats.birthtime,
        };
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({ count: files.length, files });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


app.delete('/api/downloads', (req, res) => {
  try {
    const files = fs.readdirSync(DOWNLOAD_DIR).filter((f) =>
      f.toLowerCase().endsWith('.pdf')
    );
    files.forEach((f) => fs.unlinkSync(path.join(DOWNLOAD_DIR, f)));
    res.json({ deleted: files.length, message: 'Downloads cleared' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  logger.info(`RPA PDF Crawler server running on http://localhost:${PORT}`);
  logger.info(`Downloads saved to: ${DOWNLOAD_DIR}`);
  logger.info(`Performance targets: ≤16s (target), ≤8s (stretch)`);
});

module.exports = app;
