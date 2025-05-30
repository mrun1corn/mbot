const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const axios = require('axios');

const YTSEARCH_API_URL = 'https://nexalo-api.vercel.app/api/ytsearch';

module.exports.config = {
  name: "video",
  aliases: [],
  version: "1.0",
  author: "Hridoy + GPT",
  countDown: 5,
  adminOnly: false,
  description: "Search and download a video by its name 🎬",
  category: "Music",
  guide: "{pn}video [video name] - Search and download a YouTube video",
  usePrefix: true
};

function createTempFilePath(ext = 'mp4') {
  const tempDir = path.join(__dirname, '..', '..', 'temp');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
  const fileName = `video_${crypto.randomBytes(6).toString('hex')}.${ext}`;
  return path.join(tempDir, fileName);
}

module.exports.run = async function({ api, event, args, getText }) {
  const { threadID, messageID } = event;

  try {
    const videoName = args.join(' ').trim();
    if (!videoName) {
      api.setMessageReaction("❌", messageID, () => {}, true);
      return api.sendMessage("Please provide the name of the video!", threadID, messageID);
    }

    // Step 1: Search YouTube
    const searchUrl = `${YTSEARCH_API_URL}?query=${encodeURIComponent(videoName)}`;
    const searchResponse = await axios.get(searchUrl, { timeout: 10000 });

    if (!searchResponse.data || searchResponse.data.code !== 200 || !searchResponse.data.data.length) {
      throw new Error("No video found for the given query");
    }

    const firstVideo = searchResponse.data.data[0];
    const videoUrl = firstVideo.url;
    const title = firstVideo.title;

    // Step 2: Prepare temp file
    const filePath = createTempFilePath('mp4');

    // Step 3: Send initial progress message
    const progressMsgID = await new Promise((resolve, reject) => {
      api.sendMessage(`⬇️ Downloading video: "${title}"...`, threadID, (err, info) => {
        if (err) return reject(err);
        resolve(info.messageID);
      });
    });

    // Step 4: Spawn yt-dlp to download video
    const ytdlp = spawn('yt-dlp', ['-f', 'best', '-o', filePath, videoUrl]);

    let progressBuffer = '';
    let lastUpdate = Date.now();

    ytdlp.stderr.on('data', async (data) => {
      progressBuffer += data.toString();

      // Update progress every 5 seconds
      if (Date.now() - lastUpdate > 5000) {
        const lines = progressBuffer.split('\n').reverse();
        const progressLine = lines.find(l => l.includes('[download]'));
        if (progressLine) {
          try {
            await api.editMessage(`[🔄] ${progressLine}`, threadID, progressMsgID);
          } catch (e) {
            // silently ignore edit failures
          }
        }
        lastUpdate = Date.now();
      }
    });

    ytdlp.on('close', async (code) => {
      if (code !== 0) {
        await api.sendMessage(`❌ yt-dlp exited with code ${code}`, threadID, messageID);
        return;
      }

      try {
        const stats = fs.statSync(filePath);
        if (stats.size === 0) throw new Error("Downloaded video file is empty");
      } catch (err) {
        await api.sendMessage(`❌ Error: ${err.message}`, threadID, messageID);
        return;
      }

      // Step 5: Send the video
      api.sendMessage({
        body: `✅ Downloaded: ${title}`,
        attachment: fs.createReadStream(filePath)
      }, threadID, async (err) => {
        if (err) {
          await api.sendMessage(`❌ Error sending video: ${err.message}`, threadID, messageID);
          return;
        }

        try {
          await api.unsendMessage(progressMsgID); // Remove progress message
          api.setMessageReaction("🎬", messageID, () => {}, true);
          await fs.promises.unlink(filePath); // Delete temp file
        } catch (_) {
          // ignore file delete errors
        }
      }, messageID);
    });

  } catch (err) {
    console.error("[Video Command Error]", err.message);
    api.setMessageReaction("❌", messageID, () => {}, true);
    api.sendMessage(`❌ Error: ${err.message}`, threadID, messageID);
  }
};
