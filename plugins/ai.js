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

            const userQuestion = args.join(' ');

            let context = 'This is a private chat.';

            if (m.isGroup) {
                const metadata = await sock.groupMetadata(m.from);
                const memberCount = metadata.participants.length;

                context = `
This message is from a WhatsApp group.
Group name: "${metadata.subject}"
Number of members: ${memberCount}
`;
            }

            const instruction = `
You are a WhatsApp AI assistant.
You can fully use the provided context.
If the user asks about the group, chat, members, or where they are, answer directly using the context.
Do not say you lack information if it is present.
`;

            const finalPrompt = `
${instruction}

Context:
${context}

User question:
${userQuestion}
`;

            const url = `https://ab-llama-ai.abrahamdw882.workers.dev/?q=${encodeURIComponent(finalPrompt)}`;

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
