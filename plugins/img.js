const axios = require('axios');

module.exports = {
    name: 'img',
    description: 'Search and send images',
    aliases: ['image', 'pic'],
    tags: ['tools'],
    command: /^\.?(img|image|pic)/i,

    async execute(sock, m, args) {
        try {
            if (!args[0]) {
                return m.reply('Usage: .img <query> [count]\nExample: .img sung jin woo 3');
            }

            const query = args.join(' ');
            let count = parseInt(args[args.length - 1]);

            if (isNaN(count)) count = 3;
            if (count > 5) count = 5;

            const url = `https://ab-pinetrest.abrahamdw882.workers.dev/?query=${encodeURIComponent(query)}`;

            const res = await axios.get(url);
            if (!res.data || !res.data.status || !res.data.data.length) {
                return m.reply('No images found.');
            }

            const images = res.data.data.slice(0, count);

            for (const img of images) {
                await sock.sendMessage(m.from, {
                    image: { url: img.image },
                    caption:
`📌 *${img.title || 'Pinterest Image'}*
👤 ${img.uploader.full_name}
🔗 ${img.pin_url}`
                });
            }

        } catch (err) {
            console.error('IMG plugin error:', err);
            m.reply('Failed to fetch images. Try again later.');
        }
    }
};
