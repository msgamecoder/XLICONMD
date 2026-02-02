const axios = require('axios');

module.exports = {
  name: 'ai-search',
  description: 'AI-powered search using Copilot',
  aliases: ['ais', 'searchai'],
  tags: ['ai', 'search'],
  command: /^\.?(ai-search|ais|searchai)/i,

  async execute(sock, m, args) {
    try {
      const owners = [
        '25770239992037@lid',
        '233533763772@s.whatsapp.net',
        '132779283087413@lid'
      ];

      const isOwner = owners.includes(m.sender);

      if (!args[0]) {
        return m.reply('Usage: .ai-search <query>\nExample: .ai-search Who is Elon Musk');
      }

      const userQuery = args.join(' ');

      const instruction = `
You are an AI search assistant.
Respond like a confident, intelligent search engine.

User role: ${isOwner ? 'OWNER' : 'REGULAR USER'}

Rules:
- Answer directly and clearly
- Use markdown formatting
- Be concise but informative
- Do not mention being an AI
- If unsure about facts, say "Information may vary"
`;

      const finalPrompt = `${instruction}\n\nSearch query: ${userQuery}`;

      const url = `https://capilotapi.vercel.app/?q=${encodeURIComponent(finalPrompt)}`;

      const res = await axios.get(url);
      const answer = res.data?.response;

      if (!answer) {
        return m.reply('No response from AI search.');
      }

      await m.reply(`${answer}\n\n> XLICON MD AI SEARCH`);

    } catch (err) {
      console.error('AI Search Error:', err.message);
      m.reply('AI Search failed. Please try again later.');
    }
  }
};
