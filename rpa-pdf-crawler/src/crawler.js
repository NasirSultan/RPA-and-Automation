const { chromium } = require('playwright')
const axios = require('axios')
const fs = require('fs')
const path = require('path')
const pLimit = require('p-limit')
const logger = require('./logger')

const downloadDir = path.resolve(process.env.DOWNLOAD_DIR || './downloads')
const maxConcurrent = parseInt(process.env.MAX_CONCURRENT_DOWNLOADS || '5')
const requestTimeout = parseInt(process.env.REQUEST_TIMEOUT || '15000')

if (!fs.existsSync(downloadDir)) {
  fs.mkdirSync(downloadDir, { recursive: true })
}

async function crawlForPDFs(options = {}) {
  const address = options.address || ''
  const targetUrl = options.targetUrl || process.env.TARGET_URL || 'https://abr.business.gov.au'
  const headless = options.headless !== undefined ? options.headless : process.env.HEADLESS !== 'false'

  const startTime = Date.now()

  const result = {
    success: false,
    address,
    targetUrl,
    pdfsFound: [],
    pdfsDownloaded: [],
    errors: [],
    timing: {
      total: 0,
      browser: 0,
      navigation: 0,
      search: 0,
      extraction: 0,
      download: 0
    }
  }

  let browser = null

  try {
    const t1 = Date.now()

    browser = await chromium.launch({
      headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--disable-extensions',
        '--disable-background-networking',
        '--disable-default-apps',
        '--disable-sync',
        '--disable-translate',
        '--metrics-recording-only',
        '--mute-audio',
        '--safebrowsing-disable-auto-update'
      ]
    })

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/121.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 },
      acceptDownloads: true
    })

    await context.route('**/*', route => {
      const type = route.request().resourceType()
      if (['image', 'stylesheet', 'font', 'media'].includes(type)) route.abort()
      else route.continue()
    })

    const page = await context.newPage()

    result.timing.browser = Date.now() - t1
    logger.info(`Browser launched in ${result.timing.browser}ms`)

    const t2 = Date.now()

    await page.goto(targetUrl, {
      waitUntil: 'domcontentloaded',
      timeout: requestTimeout
    })

    result.timing.navigation = Date.now() - t2
    logger.info(`Navigated to ${targetUrl} in ${result.timing.navigation}ms`)

    const t3 = Date.now()

    const pdfLinks = await performSearch(page, address, targetUrl)

    result.timing.search = Date.now() - t3
    logger.info(`Search completed in ${result.timing.search}ms found ${pdfLinks.length} pdf links`)

    const t4 = Date.now()

    const allLinks = await extractAllPDFLinks(page, targetUrl)
    const combined = deduplicateLinks([...pdfLinks, ...allLinks])

    result.pdfsFound = combined

    result.timing.extraction = Date.now() - t4
    logger.info(`Extracted ${combined.length} unique pdf links in ${result.timing.extraction}ms`)

    const t5 = Date.now()

    if (combined.length > 0) {
      const cookies = await context.cookies()
      const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ')
      result.pdfsDownloaded = await downloadPDFsConcurrently(combined, cookieStr)
    }

    result.timing.download = Date.now() - t5
    logger.info(`Downloaded ${result.pdfsDownloaded.length} pdf files in ${result.timing.download}ms`)

    result.success = true
  } catch (err) {
    logger.error(`Crawl error ${err.message}`)
    result.errors.push(err.message)
  } finally {
    if (browser) await browser.close()
    result.timing.total = Date.now() - startTime
    logger.info(`Total crawl time ${result.timing.total}ms`)
  }

  return result
}

async function performSearch(page, address, baseUrl) {
  const pdfLinks = []

  try {
    const selectors = [
      'input[type="search"]',
      'input[name*="search"]',
      'input[name*="query"]',
      'input[name*="address"]',
      'input[placeholder*="search" i]',
      'input[placeholder*="address" i]',
      '#search',
      '.search-input',
      'input[type="text"]'
    ]

    let searchInput = null

    for (const sel of selectors) {
      try {
        searchInput = await page.waitForSelector(sel, { timeout: 2000 })
        if (searchInput) break
      } catch {}
    }

    if (searchInput && address) {
      await searchInput.fill(address)
      await searchInput.press('Enter')

      await page.waitForLoadState('domcontentloaded', { timeout: 8000 })

      const links = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a[href]'))
          .map(a => a.href)
          .filter(href => href.toLowerCase().includes('.pdf'))
      })

      pdfLinks.push(...links)

      logger.info(`Search for ${address} returned ${links.length} pdf links`)
    }
  } catch (err) {
    logger.warn(`Search phase warning ${err.message}`)
  }

  return pdfLinks
}

async function extractAllPDFLinks(page, baseUrl) {
  try {
    const links = await page.evaluate(base => {
      const all = Array.from(document.querySelectorAll('a[href]'))

      return all
        .map(a => {
          try {
            return new URL(a.href, base).href
          } catch {
            return null
          }
        })
        .filter(
          href =>
            href &&
            (href.toLowerCase().includes('.pdf') ||
              href.toLowerCase().includes('pdf') ||
              href.toLowerCase().includes('download') ||
              href.toLowerCase().includes('certificate') ||
              href.toLowerCase().includes('document'))
        )
    }, baseUrl)

    return links
  } catch (err) {
    logger.warn(`PDF extraction warning ${err.message}`)
    return []
  }
}

async function downloadPDFsConcurrently(urls, cookieStr = '') {
  const limit = pLimit(maxConcurrent)
  const downloaded = []

  const tasks = urls.map(url =>
    limit(async () => {
      try {
        const filename = sanitizeFilename(url)
        const filepath = path.join(downloadDir, filename)

        if (fs.existsSync(filepath)) {
          logger.info(`Skipping cached ${filename}`)
          downloaded.push({ url, filepath, cached: true })
          return
        }

        const response = await axios({
          method: 'GET',
          url,
          responseType: 'stream',
          timeout: requestTimeout,
          headers: {
            Cookie: cookieStr,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            Accept: 'application/pdf,*/*'
          },
          maxRedirects: 5
        })

        const type = response.headers['content-type'] || ''

        if (!type.includes('pdf') && !url.toLowerCase().endsWith('.pdf')) {
          logger.warn(`Skipping non pdf ${url}`)
          return
        }

        await new Promise((resolve, reject) => {
          const writer = fs.createWriteStream(filepath)
          response.data.pipe(writer)
          writer.on('finish', resolve)
          writer.on('error', reject)
        })

        const stats = fs.statSync(filepath)

        logger.info(`Downloaded ${filename} ${(stats.size / 1024).toFixed(1)}KB`)

        downloaded.push({
          url,
          filepath,
          size: stats.size,
          cached: false
        })
      } catch (err) {
        logger.error(`Failed to download ${url} ${err.message}`)
      }
    })
  )

  await Promise.all(tasks)

  return downloaded
}

function deduplicateLinks(links) {
  return [...new Set(links)].filter(Boolean)
}

function sanitizeFilename(url) {
  try {
    const parsed = new URL(url)
    const base = path.basename(parsed.pathname) || 'document'
    const name = base.replace(/[^a-zA-Z0-9._-]/g, '_')
    return name.endsWith('.pdf') ? name : `${name}.pdf`
  } catch {
    return `pdf_${Date.now()}.pdf`
  }
}

module.exports = { crawlForPDFs }