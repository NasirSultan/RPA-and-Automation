require('dotenv').config()
const { OpenAI } = require('openai')

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

async function translateChunk(text, chunkIndex) {
  console.log(`[Worker ${chunkIndex + 1}] Translating chunk (${text.split(' ').length} words)`)

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    temperature: 0.7,
    messages: [
      {
        role: 'system',
        content:
          'You are a professional Korean to English translator. ' +
          'Translate the given Korean text to natural, accurate English. ' +
          'Preserve all paragraph breaks, line breaks, and formatting exactly as they appear. ' +
          'Do not add explanations or notes — only return the translated text.'
      },
      {
        role: 'user',
        content: `Translate the following Korean text to English:\n\n${text}`
      }
    ]
  })

  const translated = response.choices[0].message.content.trim()
  console.log(`[Worker ${chunkIndex + 1}] Done (${translated.split(' ').length} words)`)
  return translated
}

module.exports = { openai, translateChunk }