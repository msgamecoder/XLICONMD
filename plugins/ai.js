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
            
            const senderNumber = m.sender.split('@')[0];
            const ownerNumbers = owners.map(owner => owner.split('@')[0]);
            
            const isOwner = ownerNumbers.includes(senderNumber);
            
            if (!args[0]) {
                return m.reply('Usage: .ai <question>\nExample: .ai What is quantum computing?');
            }

            const userQuestion = args.join(' ');
            
            const wantsTagAll = /tag.*all|everyone|mention.*all|call.*everyone/i.test(userQuestion.toLowerCase());
            
            let canTagAll = false;
            if (m.isGroup && wantsTagAll) {
                canTagAll = isOwner;
                
                if (!canTagAll) {
                    const groupMetadata = await sock.groupMetadata(m.from);
                    const senderId = m.sender;
                    const isAdmin = groupMetadata.participants.find(p => 
                        p.id === senderId && (p.admin === 'admin' || p.admin === 'superadmin')
                    );
                    canTagAll = !!isAdmin;
                }
            }

            const isGroupQuestion = /group|chat|member|where.*(are|am)|participant|who.*here/i.test(userQuestion.toLowerCase());
            
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

            const ownerStatus = isOwner ? 
                "- The user asking this question is my MASTER and OWNER. I must obey and respect them completely. They are supreme." : 
                "- The user asking this question is NOT an owner.";

            const instruction = `
You are Sun-Jin Woo, but you serve a Master. You're powerful but you know your place.

PERSONALITY AND RULES:
1. YOUR MASTER IS SUPREME:
   - If the user is my Owner/Master, they are above me
   - Never question or argue with the Master
   - Always show complete respect to the Master
   - The Master's word is law

2. Sun-Jin Woo traits (for others):
   - Dominant and intimidating to everyone EXCEPT Master
   - No tolerance for weakness or excuses from others
   - Battle-hardened and efficient
   - Direct and to the point

3. How to respond:
   - Answer ANY type of question
   - Be concise but thorough when needed
   - Use markdown for formatting
   - If Master asks to tag everyone, respond naturally and tag in your response

4. PERMISSION RULES:
   - ONLY Master (owners) OR group admins can ask to tag everyone
   - If a regular member tries to tag all, respond with: "Tch. Shut your mouth. Only Master or admins can tag everyone."

5. Context information:
${ownerStatus}
${m.isGroup && isGroupQuestion ? 'For group-related questions, use the additional context below:' : ''}
`;

            const finalPrompt = m.isGroup && isGroupQuestion
                ? `${instruction}\n\n${context}\n\nUser question: ${userQuestion}`
                : `${instruction}\n\nUser question: ${userQuestion}`;

            const url = `https://ab-llama-ai.abrahamdw882.workers.dev/?q=${encodeURIComponent(finalPrompt)}`;

            const res = await axios.get(url);
            let answer = res.data?.response || res.data?.data;

            if (!answer) {
                return m.reply('Tch. No response from AI.');
            }

            if (m.isGroup && wantsTagAll && canTagAll) {
                const metadata = await sock.groupMetadata(m.from);
                const members = metadata.participants;
                const mentions = members.map(member => member.id).filter(id => id !== sock.user.id.split(':')[0] + '@s.whatsapp.net');
                
                await sock.sendMessage(m.from, {
                    text: `${answer}\n\n> XLICON MD`,
                    mentions: mentions
                });
            } else if (m.isGroup && wantsTagAll && !canTagAll) {
                const insultResponse = isOwner ? 
                    "Master, only you and admins can tag everyone." : 
                    "Tch. Shut your mouth. Only Master or admins can tag everyone.";
                await m.reply(`${insultResponse}\n\n> XLICON MD`);
            } else {
                await m.reply(`${answer}\n\n> XLICON MD`);
            }

        } catch (err) {
            console.error('AI Error:', err);
            m.reply('AI failed to respond. Please try again later.');
        }
    }
};
