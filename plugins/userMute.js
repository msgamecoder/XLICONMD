const mutedUsers = {};

function normalizeJid(jid) {
  if (!jid) return jid;
  return jid.endsWith('@s.whatsapp.net')
    ? jid
    : `${jid.split('@')[0]}@s.whatsapp.net`;
}

module.exports = {
  name: 'mute',
  aliases: ['unmute'],
  description: 'Mute or unmute a user',

  async execute(sock, m) {
    if (!m.isGroup) return;

    const groupJid = m.from;
    const metadata = m.groupMetadata || await sock.groupMetadata(groupJid);
    const botJid = normalizeJid(sock.user.id);

    const isBotAdmin = metadata.participants.some(
      p =>
        normalizeJid(p.id) === botJid &&
        (p.admin === 'admin' || p.admin === 'superadmin')
    );

    if (!isBotAdmin) {
      return sock.sendMessage(groupJid, {
        text: 'I must be admin.'
      });
    }

    const rawTarget =
      m.mentionedJid?.[0] ||
      m.quoted?.sender;

    if (!rawTarget) {
      return sock.sendMessage(groupJid, {
        text: 'Mention a user or reply to their message.'
      });
    }

    const target = normalizeJid(rawTarget);

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

    return sock.sendMessage(groupJid, {
      text: `🔇 @${target.split('@')[0]} muted`,
      mentions: [target]
    });
  },

  async onMessage(sock, m) {
    if (!m.isGroup) return;
    if (m.key.fromMe) return;

    const groupJid = m.from;
    if (!mutedUsers[groupJid]) return;

    const sender = normalizeJid(m.sender);

    if (mutedUsers[groupJid].has(sender)) {
      try {
        await sock.sendMessage(groupJid, {
          delete: m.key
        });
      } catch {}
    }
  }
};
