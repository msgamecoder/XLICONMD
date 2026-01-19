const axios = require('axios');

module.exports = {
    name: 'ai',
    description: 'Ask AI a question',
    aliases: ['ask'],
    tags: ['ai'],
    command: /^\.?(ai|ask)/i,

    async execute(sock, m, args) {
        try {
            if (!args[0]) {
                return m.reply('Usage: .ai <question>');
            }

            const question = args.join(' ');
            const url = `https://ab-llama-ai.abrahamdw882.workers.dev/?q=${encodeURIComponent(question)}`;

            const res = await axios.get(url);
            const answer = res.data?.response || res.data?.data;

            if (!answer) {
                return m.reply('No response from AI.');
            }

            await m.reply(`${answer}\n\n> XLICON MD`);

        } catch (err) {
            m.reply('AI failed to respond.');
        }
    }
};
