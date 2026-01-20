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
                return m.reply('Usage: .ai <question>\nExample: .ai What is quantum computing?');
            }

            const userQuestion = args.join(' ');

            const isGroupQuestion = /group|chat|member|where.*(are|am)|participant|who.*here/i.test(userQuestion);
            
            let context = '';
            if (m.isGroup && isGroupQuestion) {
                const metadata = await sock.groupMetadata(m.from);
                const memberCount = metadata.participants.length;
                
                context = `
Context (if relevant to group questions):
- You're in a WhatsApp group chat
- Group name: "${metadata.subject}"
- Member count: ${memberCount}
- This is a group conversation
`;
            }

            const instruction = `
You are a helpful AI assistant in a WhatsApp chat. You can answer ANY type of question - general knowledge, technical questions, creative ideas, analysis, etc.

${m.isGroup && isGroupQuestion ? 'For group-related questions, use the context below:' : 'Answer the user\'s question to the best of your ability.'}

Be concise but thorough when needed. You can use markdown for formatting.
`;

            const finalPrompt = m.isGroup && isGroupQuestion
                ? `${instruction}\n\n${context}\n\nUser question: ${userQuestion}`
                : `${instruction}\n\nUser question: ${userQuestion}`;

            const url = `https://ab-llama-ai.abrahamdw882.workers.dev/?q=${encodeURIComponent(finalPrompt)}`;

            const res = await axios.get(url);
            const answer = res.data?.response || res.data?.data;

            if (!answer) {
                return m.reply('No response from AI.');
            }

            await m.reply(`${answer}\n\n> XLICON MD`);

        } catch (err) {
            console.error('AI Error:', err);
            m.reply('AI failed to respond. Please try again later.');
        }
    }
};
