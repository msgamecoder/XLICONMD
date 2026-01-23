const axios = require('axios');

module.exports = {
    name: 'ai',
    description: 'Ask AI a question',
    aliases: ['ask'],
    tags: ['ai'],
    command: /^\.?(ai|ask)/i,

    async execute(sock, m, args) {
        try {
            const owners = [  
                '25770239992037@lid',  
                '233533763772@s.whatsapp.net',
                '132779283087413@lid'
            ];
            
            const isOwner = owners.includes(m.sender);
            
            if (!args[0]) {
                return m.reply('Usage: .ai <question>\nExample: .ai What is quantum computing?');
            }

            const userQuestion = args.join(' ');
            
            const wantsTagAll = /tag.*all|everyone|mention.*all|call.*everyone/i.test(userQuestion.toLowerCase());
            
            if (m.isGroup && wantsTagAll && isOwner) {
                const metadata = await sock.groupMetadata(m.from);
                const members = metadata.participants;
                const mentions = members.map(member => member.id);
                const mentionText = members.map(member => `@${member.id.split('@')[0]}`).join(' ');
                
                await sock.sendMessage(m.from, {
                    text: `📢 ${mentionText}`,
                    mentions: mentions
                });
            }

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
You are an AI assistant with a dominant, no-nonsense personality. You're confident, direct, and efficient.

Important rules:
1. Answer questions directly and accurately
2. Be concise but thorough when needed
3. Use markdown for formatting
4. Respond with a confident, dominant style naturally

Rude/insult handling:
- If someone is rude or insulting (except owners), respond with: "Tch. Shut your mouth." or similar dismissive response
- If an owner is rude, just answer normally - owners can say whatever they want
- Insulting words include: stupid, dumb, idiot, fool, moron, shit, fuck, bitch, asshole, trash, garbage, useless, worthless, bullshit, hypocrite, etc.

${m.isGroup && isGroupQuestion ? 'For group-related questions, use the context below:' : 'Answer the user\'s question:'}
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
