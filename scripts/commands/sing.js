const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const axios = require('axios');

const YTSEARCH_API_URL = 'https://nexalo-api.vercel.app/api/ytsearch';

module.exports.config = {
  name: "sing",
  aliases: [],
  version: "2.0",
  author: "Hridoy + GPT",
  countDown: 5,
  adminOnly: false,
  description: "Search and download a song as an MP3 file using yt-dlp 🎵",
  category: "Music",
  guide: "{pn}sing [music name] - Search and download a song as an MP3",
  usePrefix: true
};

module.exports.run = async function({ api, event, args, getText }) {
  const { threadID, messageID, senderID } = event;

  try {
    const musicName = args.join(' ').trim();
    if (!musicName) {
      api.setMessageReaction("❌", messageID, () => {}, true);
      return api.sendMessage(getText("sing", "missingMusicName"), threadID, messageID);
    }

    // Step 1: Search YouTube using the API
    const searchUrl = `${YTSEARCH_API_URL}?query=${encodeURIComponent(musicName)}`;
    const searchResponse = await axios.get(searchUrl, { timeout: 10000 });

    if (!searchResponse.data || searchResponse.data.code !== 200 || !searchResponse.data.data.length) {
      throw new Error("No music found for the given query");
    }

    const firstVideo = searchResponse.data.data[0];
    const videoUrl = firstVideo.url;
    const title = firstVideo.title;
    const duration = firstVideo.duration;

    // Step 2: Prepare for download
    const tempDir = path.join(__dirname, '..', '..', 'temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const fileName = `music_${crypto.randomBytes(6).toString('hex')}.mp3`;
    const filePath = path.join(tempDir, fileName);

    // Step 3: Send progress message
    const progressMsgID = await new Promise((resolve, reject) => {
      api.sendMessage(`⬇️ Downloading "${title}"...`, threadID, (err, info) => {
        if (err) return reject(err);
        resolve(info.messageID);
      });
    });

    // Step 4: Start yt-dlp
    const ytdlp = spawn('yt-dlp', [
      '-x', '--audio-format', 'mp3',
      '-o', filePath,
      videoUrl
    ]);

    let progressBuffer = '';
    let lastUpdate = Date.now();

    ytdlp.stderr.on('data', async (data) => {
      const now = Date.now();
      progressBuffer += data.toString();

      // Update progress every 5 seconds
      if (now - lastUpdate > 5000) {
        const lines = progressBuffer.split('\n');
        const progressLine = lines.find(l => l.includes('[download]'));
        if (progressLine) {
          try {
            await api.editMessage(`[🔄] ${progressLine}`, threadID, progressMsgID);
          } catch (e) {
            console.error("Failed to edit progress message:", e.message);
          }
        }
        lastUpdate = now;
      }
    });

    // Step 5: Handle completion
    ytdlp.on('close', async (code) => {
      if (code !== 0) {
        throw new Error(`yt-dlp exited with code ${code}`);
      }

      // Check the downloaded file
      const stats = fs.statSync(filePath);
      if (stats.size === 0) throw new Error("Downloaded MP3 file is empty");

      // Send audio message
      await new Promise((resolve, reject) => {
        api.sendMessage({
          body: getText("sing", "success", title, duration),
          attachment: fs.createReadStream(filePath)
        }, threadID, async (err) => {
          if (err) return reject(err);
          try {
            await api.unsendMessage(progressMsgID); // Unsend the progress message
            api.setMessageReaction("🎵", messageID, () => {}, true);
            fs.unlinkSync(filePath); // Clean up
            resolve();
          } catch (e) {
            reject(e);
          }
        }, messageID);
      });
    });

  } catch (err) {
    console.error("[Sing Command Error]", err.message);
    api.setMessageReaction("❌", messageID, () => {}, true);
    api.sendMessage(getText("sing", "error", err.message), threadID, messageID);
  }
};
