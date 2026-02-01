const mutedUsers = {};

module.exports = {
  name: 'mute',
  aliases: ['unmute'],
  description: 'Mute or unmute a tagged user',

  async execute(sock, m) {
    if (!m.isGroup) return;

    if (!m.mentionedJid?.length) {
      return sock.sendMessage(m.from, { text: '❌ Tag a user.' });
    }

    const metadata = await sock.groupMetadata(m.from);
    const botJid = sock.user.id;

    const isBotAdmin = metadata.participants.some(
      p => p.id === botJid && (p.admin === 'admin' || p.admin === 'superadmin')
    );

    if (!isBotAdmin) {
      return sock.sendMessage(m.from, { text: '❌ I must be admin.' });
    }

    const resolved = resolveMentionToLid(
      m.mentionedJid[0],
      metadata.participants
    );

    if (!resolved) {
      return sock.sendMessage(m.from, { text: '❌ Failed to resolve user.' });
    }

    if (!mutedUsers[m.from]) mutedUsers[m.from] = new Set();

    if (m.command === 'unmute') {
      mutedUsers[m.from].delete(resolved);

      return sock.sendMessage(m.from, {
        text: `🔊 @${resolved.split('@')[0]} has been unmuted.`,
        mentions: [resolved]
      });
    }

    mutedUsers[m.from].add(resolved);

    await sock.sendMessage(m.from, {
      text: `🔇 @${resolved.split('@')[0]} has been muted.`,
      mentions: [resolved]
    });
  },

  async onMessage(sock, m) {
    if (!m.isGroup) return;
    if (!mutedUsers[m.from]) return;
    if (m.key.fromMe) return;

    if (mutedUsers[m.from].has(m.sender)) {
      try {
        await sock.sendMessage(m.from, { delete: m.key });
      } catch {}
    }
  }
};

function resolveMentionToLid(mention, participants) {
  const num = mention.split('@')[0];
  return participants.find(p => p.id.startsWith(num))?.id || null;
}
