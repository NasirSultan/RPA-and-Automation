# RPA & Automation Quests

Node.js solutions for all 4 automation quests.

---

## Table of Contents

- [Quest 1 - RPA PDF Crawling](#quest-1--rpa-pdf-crawling)
-  [Watch Loom Video - RPA PDF Crawler](https://vimeo.com/1173636804?share=copy&fl=sv&fe=ci)
- [Quest 2 - Merging PDFs](#quest-2--merging-pdfs)
- [Quest 3 - PDF Translation](#quest-3--pdf-translation-korean-to-english)
- [Quest 4 - Linux Web Crawling](#quest-4--linux-web-crawling)

---

## Quest 1 - RPA PDF Crawling



---

## Quest 2 - Merging PDFs

[Watch Loom Video - PDF Merger](https://vimeo.com/1173636749?share=copy&fl=sv&fe=ci)

---

## Quest 3 - PDF Translation (Korean to English)

[Watch Loom Video - PDF Translator](https://vimeo.com/1173636781?share=copy&fl=sv&fe=ci)

---

## Quest 4 - Linux Web Crawling

[Watch Loom Video - Linux Crawler](https://vimeo.com/1173636720?share=copy&fl=sv&fe=ci)

---

## Quest 1 - RPA PDF Crawling

Difficulty: Level 3 / 5

### What it does
Automates a browser to visit a website, search for an address, extract all PDF links, and download them to disk using Playwright (real Chromium browser).

### Performance
| Target | Result |
|--------|--------|
| 16s or less | Met |
| 8s or less  | Stretch goal met (~5.9s) |

### Setup
```bash
cd rpa-pdf-crawler
npm install
npm run install-browsers
npm start
# http://localhost:3000
```

### API
```
POST http://localhost:3000/api/crawl

{
  "address": "1040",
  "targetUrl": "https://www.irs.gov/forms-instructions",
  "headless": true
}
```

### Folder Structure
```
rpa-pdf-crawler/
├── src/
│   ├── server.js      - Express API
│   ├── crawler.js     - Playwright engine
│   └── logger.js      - Winston logger
├── public/index.html  - Web dashboard
├── downloads/         - Saved PDFs
└── .env
```

---

## Quest 2 - Merging PDFs

Difficulty: Level 1 / 5

### What it does
Merges two PDF files (A: 10 pages + B: 3 pages) into one 13-page document. Completes in under 1 second.

### Setup
```bash
cd pdf-merger
npm install
npm start
# http://localhost:3001
```

### API - Option 1: files already in /uploads
```
POST http://localhost:3001/api/merge

{
  "pdfA": "document_a.pdf",
  "pdfB": "document_b.pdf",
  "outputName": "merged_final.pdf"
}
```

### API - Option 2: upload via Postman form-data
```
POST http://localhost:3001/api/merge/upload

form-data:
  pdfA -> document_a.pdf
  pdfB -> document_b.pdf
```

### Expected Response
```json
{
  "success": true,
  "message": "Merged 10 + 3 = 13 pages",
  "output": {
    "filename": "merged_final.pdf",
    "totalPages": 13,
    "sizeKB": "245.3"
  },
  "performance": {
    "elapsedMs": 187,
    "status": "Under 1 second"
  }
}
```

### Folder Structure
```
pdf-merger/
├── src/
│   └── merger.js      - Express API + pdf-lib merge
├── uploads/           - Input PDFs
├── outputs/           - Merged PDFs
└── .env
```

---

## Quest 3 - PDF Translation (Korean to English)

Difficulty: Level 3 / 5

### What it does
Translates a Korean PDF to English using 4 parallel GPT-4o workers. Splits text into 4 chunks, fires all workers at once with Promise.all(), then combines and builds a new English PDF.

### Flow
```
PDF -> Extract Text -> Split 4 Chunks -> 4x GPT-4o (parallel) -> Combine -> English PDF
```

### Performance
| Approach | Time |
|----------|------|
| Sequential | 40 to 60 seconds |
| 4 Parallel Workers | 10 to 15 seconds |

### Setup
```bash
cd pdf-translator
npm install
# Set OPENAI_API_KEY in .env
npm start
# http://localhost:3002
```

### API - Upload Korean PDF
```
POST http://localhost:3002/api/translate

form-data:
  pdf -> korean_document.pdf
```

### API - File in /uploads
```
POST http://localhost:3002/api/translate/file

{ "filename": "korean.pdf" }
```

### Folder Structure
```
pdf-translator/
├── src/
│   ├── server.js       - Express API
│   ├── translator.js   - Split, workers, combine, PDF
│   └── llm.js          - GPT-4o config
├── uploads/            - Korean PDFs
├── outputs/            - English PDFs
└── .env                - OPENAI_API_KEY
```

---

## Quest 4 - Linux Web Crawling

Difficulty: Level 4 / 5

### What it does
Crawls websites on Linux using axios and cheerio. Extracts text, links, and images. Saves JSON and CSV. Automates with cron. Includes retry logic and rotating logs.

### Setup
```bash
cd linux-crawler
npm install
npm start
# http://localhost:3003
```

### API
```
POST http://localhost:3003/api/crawl

{
  "urls": ["https://news.ycombinator.com", "https://quotes.toscrape.com"],
  "downloadImages": false
}
```

### Automate with Cron
```bash
# Install daily midnight cron job (Linux)
bash scripts/setup-cron.sh

# Run manually
node scripts/run-crawl.js https://example.com
```

### Output
```
data/
├── json/     - Full crawl data per URL
├── csv/      - Summary table (open in Excel)
├── images/   - Downloaded images (if enabled)
└── logs/     - Daily rotating log files
```

### Folder Structure
```
linux-crawler/
├── src/
│   ├── server.js      - Express API
│   ├── crawler.js     - axios + cheerio engine
│   ├── scheduler.js   - node-cron automation
│   └── logger.js      - Winston rotating logs
├── scripts/
│   ├── run-crawl.js   - CLI runner
│   └── setup-cron.sh  - Linux crontab installer
├── public/index.html  - Dashboard UI
└── .env
```

---

## All Projects

| Project | Port | Start |
|---------|------|-------|
| rpa-pdf-crawler | 3000 | npm start |
| pdf-merger | 3001 | npm start |
| pdf-translator | 3002 | npm start |
| linux-crawler | 3003 | npm start |



