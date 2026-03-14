require('dotenv').config()

const express = require('express')
const multer = require('multer')
const cors = require('cors')
const fs = require('fs')
const path = require('path')
const { PDFDocument } = require('pdf-lib')

const app = express()
const PORT = process.env.PORT || 3001
const UPLOAD = path.resolve(process.env.UPLOAD_DIR || './uploads')
const OUTPUT = path.resolve(process.env.OUTPUT_DIR || './outputs')

;[UPLOAD, OUTPUT].forEach(d => fs.mkdirSync(d, { recursive: true }))

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
}
})

async function mergePDFs(pathA, pathB, outputName = 'merged.pdf') {
const start = Date.now()

const [bytesA, bytesB] = await Promise.all([
fs.promises.readFile(pathA),
fs.promises.readFile(pathB)
])

const [docA, docB] = await Promise.all([
PDFDocument.load(bytesA),
PDFDocument.load(bytesB)
])

const merged = await PDFDocument.create()

const pagesA = await merged.copyPages(docA, docA.getPageIndices())
const pagesB = await merged.copyPages(docB, docB.getPageIndices())

pagesA.forEach(p => merged.addPage(p))
pagesB.forEach(p => merged.addPage(p))

merged.setTitle('Merged PDF')
merged.setCreationDate(new Date())

const mergedBytes = await merged.save()
const outputPath = path.join(OUTPUT, outputName)

await fs.promises.writeFile(outputPath, mergedBytes)

return {
outputPath,
outputName,
totalPages: pagesA.length + pagesB.length,
pagesFromA: pagesA.length,
pagesFromB: pagesB.length,
sizeKB: (mergedBytes.length / 1024).toFixed(1),
elapsedMs: Date.now() - start
}
}

app.get('/health', (req, res) => {
res.json({ status: 'ok', uptime: process.uptime() })
})

app.post('/api/merge', async (req, res) => {

const { pdfA, pdfB, outputName } = req.body

if (!pdfA || !pdfB)
return res.status(400).json({ error: 'Provide pdfA and pdfB filenames' })

const pathA = path.join(UPLOAD, pdfA)
const pathB = path.join(UPLOAD, pdfB)

if (!fs.existsSync(pathA))
return res.status(404).json({ error: `${pdfA} not found in uploads` })

if (!fs.existsSync(pathB))
return res.status(404).json({ error: `${pdfB} not found in uploads` })

try {

const result = await mergePDFs(pathA, pathB, outputName || 'merged.pdf')

res.json({
success: true,
message: `Merged ${result.pagesFromA} + ${result.pagesFromB} = ${result.totalPages} pages`,
output: {
filename: result.outputName,
url: `/outputs/${result.outputName}`,
totalPages: result.totalPages,
sizeKB: result.sizeKB
},
performance: {
elapsedMs: result.elapsedMs,
status: result.elapsedMs < 1000 ? 'Under 1 second' : 'Done'
},
breakdown: {
pdfA: { file: pdfA, pages: result.pagesFromA },
pdfB: { file: pdfB, pages: result.pagesFromB }
}
})

} catch (err) {
res.status(500).json({ error: err.message })
}

})

app.post(
'/api/merge/upload',
upload.fields([{ name: 'pdfA', maxCount: 1 }, { name: 'pdfB', maxCount: 1 }]),
async (req, res) => {

if (!req.files?.pdfA || !req.files?.pdfB)
return res.status(400).json({ error: 'Upload both pdfA and pdfB fields' })

const outName = `merged_${Date.now()}.pdf`

try {

const result = await mergePDFs(
req.files.pdfA[0].path,
req.files.pdfB[0].path,
outName
)

res.json({
success: true,
message: `Merged ${result.pagesFromA} + ${result.pagesFromB} = ${result.totalPages} pages`,
output: {
filename: result.outputName,
url: `/outputs/${result.outputName}`,
totalPages: result.totalPages,
sizeKB: result.sizeKB
},
performance: {
elapsedMs: result.elapsedMs,
status: result.elapsedMs < 1000 ? 'Under 1 second' : 'Done'
},
breakdown: {
pdfA: { file: req.files.pdfA[0].originalname, pages: result.pagesFromA },
pdfB: { file: req.files.pdfB[0].originalname, pages: result.pagesFromB }
}
})

} catch (err) {
res.status(500).json({ error: err.message })
}

}
)

app.get('/api/files', (req, res) => {

const uploads = fs.readdirSync(UPLOAD).filter(f => f.endsWith('.pdf'))
const outputs = fs.readdirSync(OUTPUT).filter(f => f.endsWith('.pdf'))

res.json({ uploads, outputs })

})

app.listen(PORT, () => {
console.log(`PDF Merger API -> http://localhost:${PORT}`)
console.log(`Drop PDFs in: ${UPLOAD}`)
console.log(`Merged output: ${OUTPUT}`)
})