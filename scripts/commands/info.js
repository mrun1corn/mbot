const chalk = require('chalk');

module.exports.config = {
  name: "info",
  aliases: ["admin"],
  version: "1.0",
  author: "Hridoy",
  countDown: 5,
  adminOnly: false,
  description: "Displays bot and owner information",
  category: "Utility",
  guide: "{pn}",
  usePrefix: true
};

module.exports.run = async function({ api, event, args, config }) {
  const { threadID, messageID } = event;

  try {
    api.setMessageReaction("🕥", messageID, () => {}, true);

    const currentDate = new Date();
    const dateStr = currentDate.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
    const timeStr = currentDate.toLocaleTimeString('en-US', { hour12: true });

    const response = `
• Bot & Owner Info
╰‣ Bot Name: ${config.botName}
╰‣ Bot Prefix: ${config.prefix}
╰‣ Owner: Robin
╰‣ Facebook: https://m.me/mrun1corn
╰‣ Date: ${dateStr}
╰‣ Time: ${timeStr}
    `.trim();

    api.sendMessage(response, threadID, () => {
      api.setMessageReaction("✅", messageID, () => {}, true);
    }, messageID);

    console.log(chalk.cyan(`[Info Requested] Thread: ${threadID}`));
  } catch (error) {
    console.log(chalk.red(`[Info Failed] ${error.message}`));
    api.setMessageReaction("❌", messageID, () => {}, true);
    api.sendMessage("⚠️ Failed to fetch info. Try again later!", threadID, messageID);
  }
};