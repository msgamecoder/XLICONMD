const axios = require('axios');

module.exports = {
    name: 'ocr',
    description: 'Extract text from an image URL',
    aliases: ['gettext', 'imagetotext'],
    tags: ['tools'],
    command: /^\.?(ocr|gettext|imagetotext)/i,

    async execute(sock, m, args) {
        try {
            if (!args[0]) {
                return m.reply(
                    'Provide link\nExample OCR link'
                );
            }

            const imageUrl = args[0];
            const apiUrl = `https://eliteprotech-apis.zone.id/ocr?url=${encodeURIComponent(imageUrl)}`;

            const res = await axios.get(apiUrl);
            const data = res.data;

            if (!data || !data.success) {
                return m.reply('Failed to extract text from the image.');
            }

            const text = data.text?.trim();

            if (!text) {
                return m.reply('No text detected in the image.');
            }

            await m.reply(`🧾 OCR Result\n\n${text}`);

        } catch (err) {
            console.error('OCR Error:', err);
            m.reply('OCR failed. Please try again later.');
        }
    }
};
