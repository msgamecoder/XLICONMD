const yts = require('yt-search');

module.exports = {
    name: 'ytsearch',
    description: 'Search YouTube videos',
    aliases: ['yts', 'yt'],
    tags: ['search'],
    command: /^\.?(ytsearch|yts|yt)$/i,

    async execute(sock, m, args) {
        try {
            if (!args.length) {
                return m.reply('Usage: .ytsearch <query>\nExample: .ytsearch Wizkid Essence');
            }

            const query = args.join(' ');
            const res = await yts(query);
            const videos = res.videos.slice(0, 5);

            if (!videos.length) {
                return m.reply('No results found.');
            }

            let text = `🔎 YouTube Search Results\n\n`;

            videos.forEach((v, i) => {
                text +=
`*${i + 1}. ${v.title}*
⏱ Duration: ${v.timestamp}
👤 Channel: ${v.author.name}
👁 Views: ${v.views.toLocaleString()}
🔗 ${v.url}

`;
            });

            await sock.sendMessage(m.from, { text });

        } catch (err) {
            console.error('YTSearch Error:', err);
            m.reply('❌ Failed to search YouTube.');
        }
    }
};
