require('dotenv').config()

const fs = require('fs')
const path = require('path')
const pdfParse = require('pdf-parse')
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib')
const pRetry = require('p-retry')
const { translateChunk } = require('./llm')

const WORKERCOUNT = parseInt(process.env.WORKER_COUNT || '4')
const MAXWORDSPERCHUNK = parseInt(process.env.MAX_WORDS_PER_CHUNK || '3000')
const OUTPUTDIR = path.resolve(process.env.OUTPUT_DIR || './outputs')

function sanitizeForPDF(text) {
  return text
    .replace(/→/g, '->')
    .replace(/←/g, '<-')
    .replace(/↑/g, '^')
    .replace(/↓/g, 'v')
    .replace(/⇒/g, '=>')
    .replace(/⇐/g, '<=')
    .replace(/↔/g, '<->')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2039/g, '<')
    .replace(/\u203A/g, '>')
    .replace(/\u2014/g, '--')
    .replace(/\u2013/g, '-')
    .replace(/\u2012/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u2022/g, '*')
    .replace(/\u2023/g, '>')
    .replace(/\u25CF/g, '*')
    .replace(/\u25CB/g, 'o')
    .replace(/\u2713/g, '[ok]')
    .replace(/\u2714/g, '[ok]')
    .replace(/\u2717/g, '[x]')
    .replace(/\u2718/g, '[x]')
    .replace(/\u00D7/g, 'x')
    .replace(/\u00F7/g, '/')
    .replace(/\u2212/g, '-')
    .replace(/\u00B1/g, '+/-')
    .replace(/\u2260/g, '!=')
    .replace(/\u2264/g, '<=')
    .replace(/\u2265/g, '>=')
    .replace(/\u00AE/g, '(R)')
    .replace(/\u2122/g, '(TM)')
    .replace(/\u00A9/g, '(C)')
    .replace(/[^\x00-\xFF]/g, '')
}

async function extractText(pdfPath) {
  const buffer = await fs.promises.readFile(pdfPath)
  const data = await pdfParse(buffer)
  return { text: data.text, pages: data.numpages, info: data.info }
}

function splitIntoChunks(text, numChunks = WORKERCOUNT) {
  const paragraphs = text
    .split(/\n{2,}|\r\n{2,}/)
    .map(p => p.trim())
    .filter(p => p.length > 0)

  if (paragraphs.length === 0) {
    const words = text.split(/\s+/)
    const size = Math.ceil(words.length / numChunks)
    return Array.from({ length: numChunks }, (_, i) =>
      words.slice(i * size, (i + 1) * size).join(' ')
    ).filter(c => c.trim().length > 0)
  }

  const chunkSize = Math.ceil(paragraphs.length / numChunks)

  const chunks = Array.from({ length: numChunks }, (_, i) =>
    paragraphs.slice(i * chunkSize, (i + 1) * chunkSize).join('\n\n')
  ).filter(c => c.trim().length > 0)

  const safe = []

  for (const chunk of chunks) {
    const words = chunk.split(/\s+/)

    if (words.length > MAXWORDSPERCHUNK) {
      const sub = Math.ceil(words.length / MAXWORDSPERCHUNK)
      const subSize = Math.ceil(words.length / sub)

      for (let i = 0; i < sub; i++) {
        safe.push(words.slice(i * subSize, (i + 1) * subSize).join(' '))
      }
    } else {
      safe.push(chunk)
    }
  }

  return safe
}

async function runParallelWorkers(chunks) {
  console.log(`Launching ${chunks.length} parallel workers`)

  const results = await Promise.all(
    chunks.map((chunk, index) =>
      pRetry(() => translateChunk(chunk, index), {
        retries: 3,
        onFailedAttempt: err =>
          console.warn(`[Worker ${index + 1}] Retry ${err.attemptNumber}`)
      })
    )
  )

  console.log(`All ${chunks.length} workers finished`)

  return results
}

function combineResults(chunks) {
  return chunks.join('\n\n')
}

async function buildEnglishPDF(translatedText, outputName) {
  translatedText = sanitizeForPDF(translatedText)

  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const pageWidth = 595
  const pageHeight = 842
  const margin = 50
  const fontSize = 11
  const lineHeight = fontSize * 1.5
  const maxWidth = pageWidth - margin * 2

  function wrapText(text, maxW) {
    const words = text.split(' ')
    const lines = []
    let current = ''

    for (const word of words) {
      const test = current ? `${current} ${word}` : word

      if (font.widthOfTextAtSize(test, fontSize) > maxW && current) {
        lines.push(current)
        current = word
      } else {
        current = test
      }
    }

    if (current) lines.push(current)

    return lines
  }

  let page = pdfDoc.addPage([pageWidth, pageHeight])
  let y = pageHeight - margin

  page.drawText('Translated Document (Korean -> English)', {
    x: margin,
    y,
    size: 14,
    font: boldFont,
    color: rgb(0.2, 0.2, 0.8)
  })

  y -= lineHeight * 2

  page.drawLine({
    start: { x: margin, y },
    end: { x: pageWidth - margin, y },
    thickness: 1,
    color: rgb(0.7, 0.7, 0.7)
  })

  y -= lineHeight

  const paragraphs = translatedText.split(/\n{2,}|\n/).filter(p => p.trim())

  for (const para of paragraphs) {
    if (!para.trim()) {
      y -= lineHeight * 0.5
      continue
    }

    for (const line of wrapText(para.trim(), maxWidth)) {
      if (y < margin + lineHeight) {
        page = pdfDoc.addPage([pageWidth, pageHeight])
        y = pageHeight - margin
      }

      page.drawText(line, {
        x: margin,
        y,
        size: fontSize,
        font,
        color: rgb(0.1, 0.1, 0.1)
      })

      y -= lineHeight
    }

    y -= lineHeight * 0.4
  }

  const allPages = pdfDoc.getPages()

  allPages.forEach((p, i) => {
    p.drawText(`Page ${i + 1} of ${allPages.length}  |  Translated by GPT-4o`, {
      x: margin,
      y: 25,
      size: 8,
      font,
      color: rgb(0.5, 0.5, 0.5)
    })
  })

  pdfDoc.setTitle('Translated PDF (Korean -> English)')
  pdfDoc.setCreationDate(new Date())

  const pdfBytes = await pdfDoc.save()

  const outPath = path.join(OUTPUTDIR, outputName)

  await fs.promises.writeFile(outPath, pdfBytes)

  return {
    outPath,
    outputName,
    pages: allPages.length,
    sizeKB: (pdfBytes.length / 1024).toFixed(1)
  }
}

async function translatePDF(inputPath, outputName) {
  const startTime = Date.now()

  console.log(`Starting: ${path.basename(inputPath)}`)

  console.log('Step 1: Extracting text')

  const { text, pages } = await extractText(inputPath)

  console.log(`${pages} pages, ${text.split(/\s+/).length} words`)

  if (!text || text.trim().length === 0)
    throw new Error('No text found. May be a scanned/image PDF.')

  console.log(`Step 2: Splitting into ${WORKERCOUNT} chunks`)

  const chunks = splitIntoChunks(text, WORKERCOUNT)

  chunks.forEach((c, i) =>
    console.log(`Chunk ${i + 1}: ${c.split(/\s+/).length} words`)
  )

  console.log(`Step 3 and 4: Running ${chunks.length} parallel workers`)

  const translated = await runParallelWorkers(chunks)

  console.log('Step 5: Combining results')

  const fullText = combineResults(translated)

  console.log('Step 6: Building English PDF')

  const output = await buildEnglishPDF(fullText, outputName)

  const elapsed = Date.now() - startTime

  console.log(`Done in ${elapsed}ms -> ${output.outputName} (${output.pages} pages)`)

  return {
    outputName: output.outputName,
    outputPath: output.outPath,
    outputPages: output.pages,
    outputSizeKB: output.sizeKB,
    originalPages: pages,
    chunksProcessed: chunks.length,
    workersUsed: chunks.length,
    elapsedMs: elapsed
  }
}

module.exports = { translatePDF }