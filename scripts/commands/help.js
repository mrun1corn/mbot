const chalk = require('chalk');

module.exports.config = {
  name: "help",
  aliases: ["commands", "cmd"],
  version: "1.0",
  author: "Hridoy",
  countDown: 5,
  adminOnly: false,
  description: "Displays a list of commands or detailed info about a specific command",
  category: "Utility",
  guide: "{pn} [command name] - Leave blank to see all commands",
  usePrefix: true
};

module.exports.run = async function({ api, event, args, config }) {
  const { threadID, messageID, senderID } = event;
  const commands = new Map(global.commands);
  const prefix = config.prefix;

  try {
    if (!args.length) {
      let msg = `✨ [ Guide For Beginners - Page 1 ] ✨\n`;

      const categories = {};
      for (const [name, value] of commands) {
        if (value.config.adminOnly && !config.adminUIDs.includes(senderID)) continue;
        const category = value.config.category || "Uncategorized";
        categories[category] = categories[category] || { commands: [] };
        categories[category].commands.push(name);
      }

      Object.keys(categories).sort().forEach((category) => {
        msg += `\n╭──── [ ${category.toUpperCase()} ]\n│ ✧${categories[category].commands.sort().join(" ✧ ")}\n╰───────────────◊`;
      });

      msg += `\n\n╭─『 ${config.botName || "NexaloSim"} 』\n╰‣ Total commands: ${commands.size}\n╰‣ Page 1 of 1\n╰‣ A personal Messenger bot ✨\n╰‣ ADMIN: Robin`;

      api.sendMessage(msg, threadID, messageID);
      console.log(chalk.cyan(`[Help] Full command list requested | ThreadID: ${threadID}`));
    } else {
      const commandName = args[0].toLowerCase();
      const command = commands.get(commandName) || commands.get([...commands].find(([_, v]) => v.config.aliases?.includes(commandName))?.[0]);

      if (!command) {
        api.sendMessage(`❌ Command "${commandName}" not found.`, threadID, messageID);
        console.log(chalk.red(`[Help Error] Command "${commandName}" not found | ThreadID: ${threadID}`));
        return;
      }

      const c = command.config;
      const usage = c.guide?.replace(/{pn}/g, `${prefix}${c.name}`) || `${prefix}${c.name}`;

      const res = `
╭──── NAME ───♡
│ ${c.name}
├── INFO
│ Description: ${c.description}
│ Aliases: ${c.aliases?.join(", ") || "None"}
│ Version: ${c.version || "1.0"}
│ Access: ${c.adminOnly ? "Admin Only" : "All Users"}
│ Cooldown: ${c.countDown || 1}s
│ Category: ${c.category || "Uncategorized"}
│ Author: ${c.author || "Hridoy"}
├── Usage
│ ${usage}
├── Notes
│ Use ${prefix}help for all commands
│ <text> = required, [text] = optional
╰────────────♡`.trim();

      api.sendMessage(res, threadID, messageID);
      console.log(chalk.cyan(`[Help] Details for "${commandName}" requested | ThreadID: ${threadID}`));
    }
  } catch (err) {
    console.log(chalk.red(`[Help Error] ${err.message}`));
    api.sendMessage("❌ Something went wrong with the help command.", threadID, messageID);
  }
};
