require('dotenv').config()

const express = require('express')
const multer = require('multer')
const cors = require('cors')
const fs = require('fs')
const path = require('path')
const { translatePDF } = require('./translator')

const app = express()
const PORT = process.env.PORT || 3002
const UPLOAD = path.resolve(process.env.UPLOAD_DIR || './uploads')
const OUTPUT = path.resolve(process.env.OUTPUT_DIR || './outputs')

// Ensure directories exist
if (!fs.existsSync(UPLOAD)) fs.mkdirSync(UPLOAD, { recursive: true })
if (!fs.existsSync(OUTPUT)) fs.mkdirSync(OUTPUT, { recursive: true })

app.use(cors())
app.use(express.json())
app.use('/outputs', express.static(OUTPUT))

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD),
  filename: (req, file, cb) => cb(null, `${Date.now()}_${file.originalname}`)
})

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true)
    else cb(new Error('Only PDF files allowed'))
  },
  limits: { fileSize: 50 * 1024 * 1024 }
})

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() })
})

app.post('/api/translate', upload.single('pdf'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Upload a PDF file (field name: pdf)' })

  const inputPath = req.file.path
  const outputName = `translated_${Date.now()}.pdf`

  try {
    const result = await translatePDF(inputPath, outputName)

    res.json({
      success: true,
      message: `Translated ${result.originalPages} page PDF using ${result.workersUsed} parallel workers`,
      output: {
        filename: result.outputName,
        url: `/outputs/${result.outputName}`,
        pages: result.outputPages,
        sizeKB: result.outputSizeKB
      },
      performance: {
        elapsedMs: result.elapsedMs,
        elapsedSeconds: (result.elapsedMs / 1000).toFixed(1),
        workersUsed: result.workersUsed,
        chunksProcessed: result.chunksProcessed,
        status: result.elapsedMs < 30000 ? 'Fast' : 'Done'
      }
    })
  } catch (err) {
    console.error('Translation error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/translate/file', async (req, res) => {
  const { filename } = req.body
  if (!filename) return res.status(400).json({ error: 'Provide filename' })

  const inputPath = path.join(UPLOAD, filename)
  if (!fs.existsSync(inputPath)) return res.status(404).json({ error: `${filename} not found in uploads/` })

  const outputName = `translated_${Date.now()}.pdf`

  try {
    const result = await translatePDF(inputPath, outputName)

    res.json({
      success: true,
      message: `Translated ${result.originalPages} page PDF using ${result.workersUsed} parallel workers`,
      output: {
        filename: result.outputName,
        url: `/outputs/${result.outputName}`,
        pages: result.outputPages,
        sizeKB: result.outputSizeKB
      },
      performance: {
        elapsedMs: result.elapsedMs,
        elapsedSeconds: (result.elapsedMs / 1000).toFixed(1),
        workersUsed: result.workersUsed,
        chunksProcessed: result.chunksProcessed
      }
    })
  } catch (err) {
    console.error('Translation error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/files', (req, res) => {
  const uploads = fs.readdirSync(UPLOAD).filter(f => f.endsWith('.pdf'))
  const outputs = fs.readdirSync(OUTPUT).filter(f => f.endsWith('.pdf'))
  res.json({ uploads, outputs })
})

app.listen(PORT, () => {
  console.log(`PDF Translator API → http://localhost:${PORT}`)
  console.log(`Upload PDFs to: ${UPLOAD}`)
  console.log(`English PDFs saved to: ${OUTPUT}`)
  console.log(`Workers: 4 parallel GPT-4o calls`)
})