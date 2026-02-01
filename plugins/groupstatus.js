module.exports = {
    name: 'groupstatus',
    description: 'Send group status (image, video, audio, or text)',
    aliases: ['gstatus'],
    tags: ['group'],
    command: /^\.?(groupstatus|gstatus)$/i,

    async execute(sock, m, args) {
        try {
            const owners = [
                '25770239992037@lid',
                '233533763772@s.whatsapp.net',
                '132779283087413@lid'
            ];

            const isOwner = owners.includes(m.sender);
            if (!isOwner) return m.reply('❌ Owner only command.');
            if (!m.isGroup) return m.reply('❌ Group only command.');

            const groupId = m.from;

            if (!m.quoted) {
                if (!args.length) return m.reply('❌ Reply to media or provide text.');

                const text = args.join(' ');

                await sock.sendMessage(groupId, {
                    groupStatusMessage: {
                        text,
                        backgroundColor: '#25D366',
                        font: 1
                    }
                });

                return m.reply('✅ Text group status sent!');
            }

            const q = m.quoted;
            const type = q.mtype;
            const caption =
                q.message?.imageMessage?.caption ||
                q.message?.videoMessage?.caption ||
                '';

            if (type === 'imageMessage') {
                const buffer = await q.download();

                await sock.sendMessage(groupId, {
                    groupStatusMessage: {
                        image: buffer,
                        caption
                    }
                });

                return m.reply('✅ Image group status sent!');
            }

            if (type === 'videoMessage') {
                const buffer = await q.download();

                await sock.sendMessage(groupId, {
                    groupStatusMessage: {
                        video: buffer,
                        caption
                    }
                });

                return m.reply('✅ Video group status sent!');
            }

            if (type === 'audioMessage') {
                const buffer = await q.download();

                await sock.sendMessage(groupId, {
                    groupStatusMessage: {
                        audio: buffer,
                        mimetype: 'audio/mp4',
                        ptt: q.message.audioMessage?.ptt || false
                    }
                });

                return m.reply('✅ Audio group status sent!');
            }

            m.reply('❌ Unsupported message type.');
        } catch (err) {
            console.error('GroupStatus Error:', err);
            m.reply('❌ Failed to send group status.');
        }
    }
};
