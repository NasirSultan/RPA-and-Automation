#  PDF Merger — Quest 2

[ Watch Demo Video](https://vimeo.com/1173636749?share=copy&fl=sv&fe=ci)
----

Merges two PDFs into one via a simple Express REST API.

## Setup

```bash
npm install
npm start
```

Server runs on http://localhost:3001

## Option 1 — Files in /uploads folder

```
POST http://localhost:3001/api/merge
Content-Type: application/json

{
  "pdfA": "document_a.pdf",
  "pdfB": "document_b.pdf",
  "outputName": "merged_final.pdf"
}
```

## Option 2 — Upload via Postman (form-data)

```
POST http://localhost:3001/api/merge/upload

form-data:
  pdfA  → document_a.pdf  (10 pages)
  pdfB  → document_b.pdf  (3 pages)
```

## Expected Response

```json
{
  "success": true,
  "message": "Merged 10 + 3 = 13 pages",
  "output": {
    "filename": "merged_final.pdf",
    "url": "/outputs/merged_final.pdf",
    "totalPages": 13,
    "sizeKB": "245.3"
  },
  "performance": {
    "elapsedMs": 187,
    "status": "Under 1 second"
  }
}
```

## Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| GET | /health | Health check |
| POST | /api/merge | Merge by filename (files in /uploads) |
| POST | /api/merge/upload | Upload + merge in one request |
| GET | /api/files | List all files |
