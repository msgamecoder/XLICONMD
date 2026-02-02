const axios = require('axios')
const FormData = require('form-data')

module.exports = {
  name: 'ocr',
  description: 'Extract text from an image',
  aliases: ['readtext'],
  tags: ['tools'],
  command: /^\.?(ocr|readtext)$/i,

  async execute(sock, m, args) {
    try {
      if (!m.quoted) return m.reply('Reply to an image to extract text.')
      if (!m.quoted.message?.imageMessage)
        return m.reply(' Please reply to an image.')

      m.reply('> ⏳ Reading text from image...')

      const buffer = await m.quoted.download()

      const form = new FormData()
      form.append('apikey', process.env.OCR_API_KEY || 'K81241004488957')
      form.append('language', 'eng')
      form.append('isOverlayRequired', 'false')
      form.append('file', buffer, {
        filename: 'image.jpg',
        contentType: 'image/jpeg',
      })

      const res = await axios.post(
        'https://api.ocr.space/parse/image',
        form,
        {
          headers: form.getHeaders(),
          maxBodyLength: Infinity,
        }
      )

      if (res.data.OCRExitCode !== 1) {
        return m.reply(' OCR failed.')
      }

      const text = res.data.ParsedResults?.[0]?.ParsedText?.trim()

      if (!text) return m.reply('No text detected.')

      m.reply(`📄 *OCR Result:*\n\n${text}`)
    } catch (err) {
      console.error('OCR Error:', err)
      m.reply('Failed to process OCR.')
    }
  },
}
