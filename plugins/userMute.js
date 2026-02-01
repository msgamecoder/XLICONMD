const mutedUsers = {};

module.exports = {
  name: 'mute',
  aliases: ['unmute'],
  description: 'Mute or unmute a tagged user',

  async execute(sock, m) {
    if (!m.isGroup) return;

    const metadata = await sock.groupMetadata(m.from);
    const botJid = sock.user.id;

    const isBotAdmin = metadata.participants.some(
      p => p.id === botJid && (p.admin === 'admin' || p.admin === 'superadmin')
    );

    if (!isBotAdmin) {
      return sock.sendMessage(m.from, { text: 'I must be admin.' });
    }

    let target = null;

    if (m.mentionedJid?.length) {
      const mentionNum = m.mentionedJid[0].split('@')[0];
      target = metadata.participants.find(p =>
        p.id.startsWith(mentionNum)
      )?.id;
    } else if (m.quoted?.sender) {
      target = m.quoted.sender;
    }

    if (!target) {
      return sock.sendMessage(m.from, {
        text: 'Mention a user or reply to their message.'
      });
    }

    if (!mutedUsers[m.from]) mutedUsers[m.from] = new Set();

    if (m.command === 'unmute') {
      mutedUsers[m.from].delete(target);

      return sock.sendMessage(m.from, {
        text: `🔊 @${target.split('@')[0]} has been unmuted.`,
        mentions: [target]
      });
    }

    mutedUsers[m.from].add(target);

    await sock.sendMessage(m.from, {
      text: `🔇 @${target.split('@')[0]} has been muted.`,
      mentions: [target]
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
