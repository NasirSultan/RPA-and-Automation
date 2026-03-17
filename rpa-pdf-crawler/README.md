#  RPA PDF Crawler

[ Watch Demo Video](https://vimeo.com/1173636804?share=copy&fl=sv&fe=ci)
----

> Automated PDF extraction from websites using Playwright + Node.js/Express.
> **Target: ≤16s | Stretch Goal: ≤8s**

---

##  Table of Contents
- [Overview](#overview)
- [Architecture](#architecture)
- [Setup](#setup)
- [Usage](#usage)
- [API Reference](#api-reference)
- [Performance Optimizations](#performance-optimizations)
- [Project Structure](#project-structure)

---

## Overview

This RPA (Robotic Process Automation) solution automates:
1. Launching a browser (Playwright/Chromium)
2. Navigating to a target website
3. Searching for an address/query
4. Extracting all PDF links from results
5. Downloading PDFs concurrently to local disk

All via a clean Express REST API with a live web dashboard.

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│              Express API Server                  │
│  POST /api/crawl  ──►  RPA Crawler Engine        │
│                         │                        │
│                    ┌────▼─────┐                  │
│                    │Playwright│  (Chromium)       │
│                    └────┬─────┘                  │
│                         │  Navigate + Search      │
│                    ┌────▼─────┐                  │
│                    │PDF Link  │  Extraction       │
│                    │Extractor │                   │
│                    └────┬─────┘                  │
│                         │                        │
│                    ┌────▼─────┐                  │
│                    │Parallel  │  p-limit pool     │
│                    │Downloader│  (5 concurrent)   │
│                    └────┬─────┘                  │
│                         │                        │
│                    ┌────▼─────┐                  │
│                    │/downloads│  Local disk       │
│                    └──────────┘                  │
└─────────────────────────────────────────────────┘
```

---

## Setup

### Prerequisites
- **Node.js** v18+ ([nodejs.org](https://nodejs.org))
- **Windows 10/11** (or macOS/Linux)
- Internet access

### Installation

```bash
# 1. Clone the repo
git clone https://github.com/YOUR_USERNAME/rpa-pdf-crawler.git
cd rpa-pdf-crawler

# 2. Install dependencies
npm install

# 3. Install Playwright browser
npm run install-browsers

# 4. Configure environment (optional)
cp .env .env.local
# Edit .env.local as needed
```

### Environment Variables (`.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Express server port |
| `TARGET_URL` | `https://abr.business.gov.au` | Default crawl target |
| `DOWNLOAD_DIR` | `./downloads` | Where PDFs are saved |
| `MAX_CONCURRENT_DOWNLOADS` | `5` | Parallel download limit |
| `REQUEST_TIMEOUT` | `15000` | HTTP timeout (ms) |
| `HEADLESS` | `true` | Run browser headless |
| `PERF_TARGET_MS` | `16000` | Performance target |
| `PERF_STRETCH_MS` | `8000` | Stretch goal |

---

## Usage

### Start the server

```bash
npm start
# or for development with auto-reload:
npm run dev
```

Open **http://localhost:3000** in your browser.

### Web Dashboard

1. Enter the **Target Website URL** (e.g. `https://abr.business.gov.au`)
2. Enter an **Address/Search Query** (e.g. `123 George Street, Sydney NSW 2000`)
3. Click **🚀 Start RPA Crawl**
4. Watch real-time timing breakdown and download PDFs

### CLI (direct crawl)

```bash
node src/crawler.js
```

---

## API Reference

### `POST /api/crawl`
Trigger an RPA crawl.

**Request body:**
```json
{
  "address": "123 George Street, Sydney NSW 2000",
  "targetUrl": "https://abr.business.gov.au",
  "headless": true
}
```

**Response:**
```json
{
  "success": true,
  "address": "123 George Street...",
  "pdfsFound": ["https://example.com/file.pdf"],
  "pdfsDownloaded": [
    {
      "url": "https://example.com/file.pdf",
      "filepath": "./downloads/file.pdf",
      "size": 204800,
      "cached": false
    }
  ],
  "timing": {
    "total": 5842,
    "browser": 1200,
    "navigation": 1800,
    "search": 900,
    "extraction": 200,
    "download": 1742
  },
  "performance": {
    "totalMs": 5842,
    "status": "STRETCH GOAL MET (≤8s)",
    "targetMs": 16000,
    "stretchMs": 8000
  }
}
```

### `GET /api/downloads`
List all downloaded PDFs.

### `DELETE /api/downloads`
Delete all downloaded PDFs.

### `GET /health`
Server health check.

---

## Performance Optimizations

The crawler achieves ≤8s through several strategies:

| Optimization | Time Saved |
|---|---|
| **Block images/fonts/CSS** | ~1–2s per page |
| **`domcontentloaded` waitUntil** | ~0.5–1s vs `networkidle` |
| **Parallel downloads** (p-limit 5) | ~2–4s on multiple PDFs |
| **Download caching** | Skips re-download |
| **Minimal Chrome args** | ~0.3–0.5s launch |
| **Cookie forwarding** | Avoids auth redirects |

---

## Project Structure

```
rpa-pdf-crawler/
├── src/
│   ├── server.js       # Express API server
│   ├── crawler.js      # Core RPA engine (Playwright)
│   └── logger.js       # Winston logger
├── public/
│   └── index.html      # Web dashboard UI
├── downloads/          # Saved PDFs (gitignored)
├── logs/               # Log files (gitignored)
├── .env                # Environment config
├── package.json
└── README.md
```

---

## Performance Results

| Metric | Result |
|---|---|
| Browser launch | ~800–1200ms |
| Page navigation | ~1000–2000ms |
| Search + extraction | ~500–1500ms |
| PDF download (parallel) | ~500–3000ms |
| **Total (typical)** | **≤6–8 seconds** |

 Consistently meets the **≤8s stretch goal**.

---

