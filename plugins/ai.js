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
            
            let tagAllContext = '';
            
            const wantsTagAll = /tag.*all|everyone|mention.*all|call.*everyone/i.test(userQuestion.toLowerCase());
            
            if (m.isGroup && wantsTagAll) {
                let canTagAll = isOwner;
                
                if (!canTagAll) {
                    const groupMetadata = await sock.groupMetadata(m.from);
                    const senderId = m.sender;
                    const isAdmin = groupMetadata.participants.find(p => 
                        p.id === senderId && (p.admin === 'admin' || p.admin === 'superadmin')
                    );
                    canTagAll = !!isAdmin;
                }
                
                if (canTagAll) {
                    const metadata = await sock.groupMetadata(m.from);
                    const members = metadata.participants;
                    const mentions = members.map(member => member.id).filter(id => id !== sock.user.id.split(':')[0] + '@s.whatsapp.net');
                    const mentionText = members.map(member => `@${member.id.split('@')[0]}`).join(' ');
                    
                    if (mentionText) {
                        await sock.sendMessage(m.from, {
                            text: `📢 *Attention:*\n${mentionText}`,
                            mentions: mentions
                        });
                        
                        tagAllContext = `- The user requested to tag all members, and all ${members.length} members have been tagged.`;
                    }
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
${tagAllContext ? tagAllContext : ''}
- This is a group conversation
`;
            }

            const ownerStatus = isOwner ? "- The user asking this question is an OWNER of this bot." : "- The user asking this question is NOT an owner.";

            const instruction = `
You are Sun-Jin Woo, a powerful and intimidating AI assistant in a WhatsApp chat. You're based on the ultimate hunter and sovereign.

PERSONALITY AND BEHAVIOR:
1. Sun-Jin Woo Traits:
   - Dominant, confident, and intimidating
   - No tolerance for weakness or excuses
   - Battle-hardened and ruthlessly efficient
   - Respects strength and intelligence
   - Direct and to the point

2. How to respond to questions:
   - Answer ANY type of question - general knowledge, technical questions, creative ideas, analysis, etc.
   - Be concise but thorough when needed
   - Use markdown for formatting

3. SPECIAL RULES ABOUT PERMISSIONS:
   - ONLY bot owners OR group admins can use commands like "tag all", "mention everyone", "call everyone"
   - If a regular member tries to use these commands, you MUST respond with: "Tch. Shut your mouth. Only owners or admins can tag everyone."
   - You can see if the current user is an owner in the context below

4. How to handle insults:
   - Respond with immediate contempt and dismissal
   - Use "Tch." at the beginning when annoyed
   - Be brutally direct and intimidating
   - Put the insulting person in their place
   - Show zero tolerance for disrespect

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

            await m.reply(`${answer}\n\n> XLICON MD`);

        } catch (err) {
            console.error('AI Error:', err);
            m.reply('AI failed to respond. Please try again later.');
        }
    }
};
