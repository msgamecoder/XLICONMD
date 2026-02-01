const mutedUsers = {};

module.exports = {
  name: 'mute',
  aliases: ['unmute'],
  description: 'Mute or unmute a user',

  async execute(sock, m) {
    if (!m.isGroup) return;

    const metadata = await sock.groupMetadata(m.from);
    const botNum = sock.user.id.split('@')[0];

    const isBotAdmin = metadata.participants.some(
      p =>
        p.id.startsWith(botNum) &&
        (p.admin === 'admin' || p.admin === 'superadmin')
    );

    if (!isBotAdmin) {
      return sock.sendMessage(m.from, { text: 'I must be admin.' });
    }

    const text = m.body || m.text || '';
    let target = null;

    const match = text.match(/@(\d{5,})/);
    if (match) {
      const num = match[1];
      target = metadata.participants.find(p =>
        p.id.startsWith(num)
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
        text: `🔊 @${target.split('@')[0]} unmuted`,
        mentions: [target]
      });
    }

    mutedUsers[m.from].add(target);
    await sock.sendMessage(m.from, {
      text: `🔇 @${target.split('@')[0]} muted`,
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
