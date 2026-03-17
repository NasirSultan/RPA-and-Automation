# Linux Web Crawler — Quest 4

[ Watch Demo Video](https://vimeo.com/1173636720?share=copy&fl=sv&fe=ci)
----
Node.js web crawler for Linux. Extracts text, links, images → saves JSON + CSV. Automated via cron.

## Stack
- **axios** — HTTP requests (Linux-compatible headers)
- **cheerio** — HTML parsing (server-side jQuery)
- **node-cron** — In-process scheduler
- **winston** — Rotating log files
- **csv-writer** — CSV output
- **p-limit** — Concurrent image downloads

## Setup

```bash
npm install
npm start
# Dashboard → http://localhost:3003
```

## API

### Crawl
```
POST http://localhost:3003/api/crawl
{ "urls": ["https://news.ycombinator.com", "https://quotes.toscrape.com"], "downloadImages": false }
```

### List saved files
```
GET http://localhost:3003/api/results
```

### View logs
```
GET http://localhost:3003/api/logs?lines=100
```

## CLI Usage (Linux)
```bash

node scripts/run-crawl.js https://example.com https://news.ycombinator.com


bash scripts/setup-cron.sh


crontab -l
```

## Output Structure
```
data/
├── json/   ← Full crawl data (titles, links, paragraphs, images)
├── csv/    ← Summary spreadsheet (one row per URL)
├── images/ ← Downloaded images (if enabled)
└── logs/   ← Daily rotating logs
```

## Sample JSON Output
```json
{
  "results": [
    {
      "url": "https://news.ycombinator.com",
      "title": "Hacker News",
      "crawledAt": "2024-03-13T00:00:00.000Z",
      "headings": [...],
      "paragraphs": [...],
      "links": [...],
      "images": [...],
      "stats": { "headingCount": 5, "linkCount": 92, "imageCount": 3, "paragraphCount": 8 }
    }
  ],
  "errors": []
}
```

## Folder Structure
```
linux-crawler/
├── src/
│   ├── server.js     ← Express API + scheduler startup
│   ├── crawler.js    ← Core crawl engine
│   ├── scheduler.js  ← node-cron automation
│   └── logger.js     ← Winston rotating logger
├── scripts/
│   ├── run-crawl.js  ← CLI runner
│   └── setup-cron.sh ← Installs Linux crontab entry
├── public/
│   └── index.html    ← Web dashboard
├── data/             ← Output (gitignored)
├── .env
└── package.json
```
