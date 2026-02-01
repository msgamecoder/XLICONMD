const mutedUsers = {};

module.exports = {
  name: 'mute',
  aliases: ['unmute'],
  description: 'Mute or unmute a user',

  async execute(sock, m) {
    if (!m.isGroup) return;

    const groupJid = m.from;
    const metadata = await sock.groupMetadata(groupJid);
    const botJid = sock.user.id;

    const isBotAdmin = metadata.participants.some(
      p =>
        p.id === botJid &&
        (p.admin === 'admin' || p.admin === 'superadmin')
    );

    if (!isBotAdmin) {
      return sock.sendMessage(groupJid, {
        text: 'I must be admin.'
      });
    }

    const target =
      m.mentionedJid?.[0] ||
      m.quoted?.sender;

    if (!target) {
      return sock.sendMessage(groupJid, {
        text: 'Mention a user or reply to their message.'
      });
    }

    if (!mutedUsers[groupJid]) {
      mutedUsers[groupJid] = new Set();
    }

    if (m.command === 'unmute') {
      mutedUsers[groupJid].delete(target);

      return sock.sendMessage(groupJid, {
        text: `🔊 @${target.split('@')[0]} unmuted`,
        mentions: [target]
      });
    }

    mutedUsers[groupJid].add(target);

    await sock.sendMessage(groupJid, {
      text: `🔇 @${target.split('@')[0]} muted`,
      mentions: [target]
    });
  },

  async onMessage(sock, m) {
    if (!m.isGroup) return;
    if (m.key.fromMe) return;

    const groupJid = m.from;
    const sender = m.sender;

    if (!mutedUsers[groupJid]) return;

    if (mutedUsers[groupJid].has(sender)) {
      try {
        await sock.sendMessage(groupJid, {
          delete: m.key
        });
      } catch {}
    }
  }
};
