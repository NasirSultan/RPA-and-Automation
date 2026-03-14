# 🌐 PDF Translator — Korean → English

Translates Korean PDFs to English using **4 parallel GPT-4o workers**.

## Flow

```
PDF → Extract Text → Split 4 Chunks → 4x GPT-4o Workers (parallel) → Combine → English PDF
```

## Setup

```bash
npm install
# Add your OpenAI key to .env
npm start
```

Server runs on http://localhost:3002

---

## API

### Option 1 — Upload PDF directly (Postman form-data)

```
POST http://localhost:3002/api/translate

form-data:
  pdf → [your korean PDF file]
```

### Option 2 — File already in /uploads folder

```
POST http://localhost:3002/api/translate/file
Content-Type: application/json

{ "filename": "korean_doc.pdf" }
```

---

## Expected Response

```json
{
  "success": true,
  "message": "✅ Translated 13 page PDF using 4 parallel workers",
  "output": {
    "filename": "translated_1234567890.pdf",
    "url": "/outputs/translated_1234567890.pdf",
    "pages": 13,
    "sizeKB": "312.4"
  },
  "performance": {
    "elapsedMs": 14200,
    "elapsedSeconds": "14.2",
    "workersUsed": 4,
    "chunksProcessed": 4,
    "status": "🏆 Fast"
  }
}
```

---

## Folder Structure

```
pdf-translator/
├── src/
│   ├── server.js       ← Express API
│   ├── translator.js   ← Core engine (split → workers → combine → PDF)
│   └── llm.js          ← OpenAI GPT-4o config
├── uploads/            ← Place Korean PDFs here
├── outputs/            ← Translated English PDFs saved here
├── .env                ← OPENAI_API_KEY goes here
└── package.json
```
