const axios = require('axios');

module.exports = {
    name: 'waifu',
    description: 'Send random waifu images',
    aliases: ['animewaifu'],
    tags: ['anime'],
    command: /^\.?(waifu|animewaifu)/i,

    async execute(sock, m, args) {
        try {
            let count = parseInt(args[0]);
            if (isNaN(count)) count = 1;
            if (count > 2) count = 2; // max 2

            const waifuUrl = 'https://ab-animerandomy.abrahamdw882.workers.dev/waifu';

            if (count === 1) {
                await m.reply('✨ Random Waifu ✨');

                const res = await axios.get(waifuUrl, {
                    responseType: 'arraybuffer'
                });

                return sock.sendMessage(m.from, {
                    image: res.data,
                    caption: '> Powered by XLICON V2'
                });
            }

            await m.reply(`✨ Sending ${count} random waifus ✨`);

            for (let i = 0; i < count; i++) {
                const res = await axios.get(waifuUrl, {
                    responseType: 'arraybuffer'
                });

                await sock.sendMessage(m.from, {
                    image: res.data
                });
            }

        } catch (err) {
            console.error('❌ Waifu command error:', err);
            m.reply('Failed to fetch waifu image.');
        }
    }
};
