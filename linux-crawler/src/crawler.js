
require('dotenv').config();

const axios    = require('axios');
const cheerio  = require('cheerio');
const fs       = require('fs');
const path     = require('path');
const pLimit   = require('p-limit');
const { createObjectCsvWriter } = require('csv-writer');
const logger   = require('./logger');

const CONFIG = {
  timeout:       parseInt(process.env.REQUEST_TIMEOUT  || '15000'),
  retries:       parseInt(process.env.RETRY_ATTEMPTS   || '3'),
  retryDelay:    parseInt(process.env.RETRY_DELAY      || '2000'),
  concurrent:    parseInt(process.env.MAX_CONCURRENT   || '5'),
  rateLimit:     parseInt(process.env.RATE_LIMIT_MS    || '1000'),
  jsonDir:       path.resolve(process.env.JSON_DIR     || './data/json'),
  csvDir:        path.resolve(process.env.CSV_DIR      || './data/csv'),
  imageDir:      path.resolve(process.env.IMAGE_DIR    || './data/images'),
};


[CONFIG.jsonDir, CONFIG.csvDir, CONFIG.imageDir].forEach(d =>
  fs.mkdirSync(d, { recursive: true })
);


const http = axios.create({
  timeout: CONFIG.timeout,
  headers: {
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Accept':     'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate',
    'Connection': 'keep-alive',
  },
});


async function fetchWithRetry(url, attempt = 1) {
  try {
    logger.info(`Fetching [attempt ${attempt}]: ${url}`);
    const res = await http.get(url);
    return res;
  } catch (err) {
    const isRetryable = !err.response || err.response.status >= 500 || err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT';

    if (attempt < CONFIG.retries && isRetryable) {
      const delay = CONFIG.retryDelay * attempt;
      logger.warn(`Retry ${attempt}/${CONFIG.retries} for ${url} — waiting ${delay}ms (${err.message})`);
      await sleep(delay);
      return fetchWithRetry(url, attempt + 1);
    }

    logger.error(`Failed after ${attempt} attempts: ${url} — ${err.message}`);
    throw err;
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}


function extractPageData(url, html) {
  const $        = cheerio.load(html);
  const baseUrl  = new URL(url);


  const headings = [];
  $('h1, h2, h3, h4').each((_, el) => {
    const text = $(el).text().trim();
    if (text) headings.push({ tag: el.tagName, text });
  });

  const paragraphs = [];
  $('p').each((_, el) => {
    const text = $(el).text().trim();
    if (text && text.length > 20) paragraphs.push(text);
  });


  const links = [];
  $('a[href]').each((_, el) => {
    try {
      const href = new URL($(el).attr('href'), baseUrl).href;
      const text = $(el).text().trim();
      links.push({ text, href });
    } catch {  }
  });


  const images = [];
  $('img[src]').each((_, el) => {
    try {
      const src = new URL($(el).attr('src'), baseUrl).href;
      const alt = $(el).attr('alt') || '';
      images.push({ src, alt });
    } catch { }
  });


  const title       = $('title').text().trim();
  const description = $('meta[name="description"]').attr('content') || '';
  const keywords    = $('meta[name="keywords"]').attr('content') || '';

  return {
    url,
    crawledAt:   new Date().toISOString(),
    title,
    description,
    keywords,
    headings,
    paragraphs:  paragraphs.slice(0, 50),   // cap at 50
    links:       links.slice(0, 100),        // cap at 100
    images:      images.slice(0, 50),        // cap at 50
    stats: {
      headingCount:   headings.length,
      paragraphCount: paragraphs.length,
      linkCount:      links.length,
      imageCount:     images.length,
    },
  };
}


async function downloadImages(images, domain) {
  const limit    = pLimit(CONFIG.concurrent);
  const domainDir = path.join(CONFIG.imageDir, domain.replace(/[^a-z0-9]/gi, '_'));
  fs.mkdirSync(domainDir, { recursive: true });

  const downloaded = [];

  await Promise.all(
    images.slice(0, 20).map(img =>  
      limit(async () => {
        try {
          const filename = path.basename(new URL(img.src).pathname) || `img_${Date.now()}.jpg`;
          const filepath = path.join(domainDir, filename);

          if (fs.existsSync(filepath)) {
            downloaded.push({ ...img, filepath, cached: true });
            return;
          }

          const res = await http.get(img.src, { responseType: 'stream', timeout: 8000 });
          await new Promise((resolve, reject) => {
            const writer = fs.createWriteStream(filepath);
            res.data.pipe(writer);
            writer.on('finish', resolve);
            writer.on('error', reject);
          });

          downloaded.push({ ...img, filepath, cached: false });
        } catch (err) {
          logger.warn(`Image download failed: ${img.src} — ${err.message}`);
        }
      })
    )
  );

  return downloaded;
}


async function saveJSON(data, label) {
  const filename = `${label}_${Date.now()}.json`;
  const filepath = path.join(CONFIG.jsonDir, filename);
  await fs.promises.writeFile(filepath, JSON.stringify(data, null, 2), 'utf8');
  logger.info(`JSON saved: ${filepath}`);
  return filepath;
}


async function saveCSV(pages, label) {
  const filename = `${label}_${Date.now()}.csv`;
  const filepath = path.join(CONFIG.csvDir, filename);

  const writer = createObjectCsvWriter({
    path: filepath,
    header: [
      { id: 'url',            title: 'URL' },
      { id: 'title',          title: 'Title' },
      { id: 'description',    title: 'Description' },
      { id: 'crawledAt',      title: 'Crawled At' },
      { id: 'headingCount',   title: 'Headings' },
      { id: 'paragraphCount', title: 'Paragraphs' },
      { id: 'linkCount',      title: 'Links' },
      { id: 'imageCount',     title: 'Images' },
    ],
  });

  const rows = pages.map(p => ({
    url:            p.url,
    title:          p.title,
    description:    p.description,
    crawledAt:      p.crawledAt,
    headingCount:   p.stats.headingCount,
    paragraphCount: p.stats.paragraphCount,
    linkCount:      p.stats.linkCount,
    imageCount:     p.stats.imageCount,
  }));

  await writer.writeRecords(rows);
  logger.info(`CSV saved: ${filepath}`);
  return filepath;
}


async function crawl(urls = [], options = {}) {
  const { downloadImgs = false } = options;
  const startTime = Date.now();
  const results   = [];
  const errors    = [];

  logger.info(`========================================`);
  logger.info(`Starting crawl of ${urls.length} URL(s)`);
  logger.info(`========================================`);

  for (const url of urls) {
    try {

      if (results.length > 0) await sleep(CONFIG.rateLimit);

      const res      = await fetchWithRetry(url);
      const pageData = extractPageData(url, res.data);


      if (downloadImgs && pageData.images.length > 0) {
        const domain = new URL(url).hostname;
        pageData.downloadedImages = await downloadImages(pageData.images, domain);
        logger.info(`Downloaded ${pageData.downloadedImages.length} images from ${url}`);
      }

      results.push(pageData);
      logger.info(` Crawled: ${url} — ${pageData.stats.linkCount} links, ${pageData.stats.imageCount} images`);
    } catch (err) {
      errors.push({ url, error: err.message, timestamp: new Date().toISOString() });
      logger.error(` Failed: ${url} — ${err.message}`);
    }
  }

  // Save outputs
  const label     = `crawl_${new Date().toISOString().replace(/[:.]/g, '-')}`;
  const jsonPath  = await saveJSON({ results, errors, crawledAt: new Date().toISOString() }, label);
  const csvPath   = results.length > 0 ? await saveCSV(results, label) : null;

  const elapsed = Date.now() - startTime;

  const summary = {
    success:      true,
    totalUrls:    urls.length,
    succeeded:    results.length,
    failed:       errors.length,
    elapsedMs:    elapsed,
    elapsedSec:   (elapsed / 1000).toFixed(1),
    outputs: {
      json: jsonPath,
      csv:  csvPath,
    },
    errors,
  };

  logger.info(`========================================`);
  logger.info(`Crawl complete: ${results.length}/${urls.length} succeeded in ${elapsed}ms`);
  logger.info(`JSON: ${jsonPath}`);
  if (csvPath) logger.info(`CSV:  ${csvPath}`);
  logger.info(`========================================`);

  return summary;
}

module.exports = { crawl };
