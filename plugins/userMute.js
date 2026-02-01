const owners = [
  '25770239992037@lid',
  '227903916765325@lid',
  '233533763772@s.whatsapp.net',
  '132779283087413@lid'
];

module.exports = {
  name: 'retag',
  description: 'Retag users using group participants only (Owner only)',

  async execute() {},

  async onMessage(sock, m) {
    if (!m.isGroup) return;
    if (!m.text || m.isBot) return;
    if (!m.text.startsWith('.retag')) return;

    if (!owners.includes(m.sender)) return;

    const metadata = await sock.groupMetadata(m.from);

    const participants = metadata.participants
      .slice(0, 5)
      .map(p => p.id);

    const text = participants
      .map(p => `@${p.split('@')[0]}`)
      .join('\n');

    await sock.sendMessage(m.from, {
      text,
      mentions: participants
    });
  }
};
