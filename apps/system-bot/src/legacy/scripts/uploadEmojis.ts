// ══════════════════════════════════════════════════════════════
//  Emoji Auto-Upload Script for Opus V2
//  Run: npx ts-node src/scripts/uploadEmojis.ts
// ══════════════════════════════════════════════════════════════

import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v10";
import { Config } from "../config";
import { Logger } from "../utils/logger";
import { config } from "dotenv";

config(); // Load environment variables

const rest = new REST({ version: "10" }).setToken(Config.token);

/**
 * List of emoji sources from emoji.gg to automatically upload to the application.
 * You can customize the image URLs if you find better ones on emoji.gg.
 */
const EMOJI_SOURCES: Record<string, string> = {
  // Moderation & Status (GIF/PNG from emoji.gg)
  opus_success: "https://cdn.emoji.gg/emojis/8422-green-tick.gif",
  opus_error: "https://cdn.emoji.gg/emojis/6290-red-cross.gif",
  opus_warning: "https://cdn.emoji.gg/emojis/8437-warning.gif",
  opus_info: "https://cdn.emoji.gg/emojis/8951-info.png",
  opus_ban: "https://cdn.emoji.gg/emojis/3910-ban-hammer.gif",
  opus_kick: "https://cdn.emoji.gg/emojis/2374-boot.gif",
  opus_timeout: "https://cdn.emoji.gg/emojis/1344-timeout.png",
  opus_warn: "https://cdn.emoji.gg/emojis/3282-alert.gif",
  opus_shield: "https://cdn.emoji.gg/emojis/9282-shield.gif",
  opus_filter: "https://cdn.emoji.gg/emojis/2123-filter.png",

  // Economy & Levels
  opus_credits: "https://cdn.emoji.gg/emojis/8437-coin.gif",
  opus_xp: "https://cdn.emoji.gg/emojis/5270-star.gif",
  opus_rank: "https://cdn.emoji.gg/emojis/1234-trophy.gif",
  opus_daily: "https://cdn.emoji.gg/emojis/5678-gift.gif",
  opus_rep: "https://cdn.emoji.gg/emojis/9012-heart.gif",

  // General Icons
  opus_settings: "https://cdn.emoji.gg/emojis/3456-gear.gif",
  opus_logs: "https://cdn.emoji.gg/emojis/7890-clipboard.png",
  opus_voice: "https://cdn.emoji.gg/emojis/2345-mic.png",
  opus_welcome: "https://cdn.emoji.gg/emojis/6789-wave.gif",
  opus_leave: "https://cdn.emoji.gg/emojis/0123-door.gif",
};

/**
 * Downloads an image from a URL and converts it to a base64 Data URI
 * suitable for Discord's API.
 */
async function getBase64Image(url: string): Promise<string> {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  const mimeType = url.endsWith(".gif") ? "image/gif" : "image/png";
  return `data:${mimeType};base64,${base64}`;
}

async function run() {
  Logger.divider();
  Logger.info(`Starting Emoji Auto-Upload for Application ${Config.clientId}`);
  Logger.info(`Fetching existing application emojis...`);

  try {
    // 1. Fetch existing application emojis
    const existingEmojis: any = await rest.get(Routes.applicationEmojis(Config.clientId));
    const existingNames = new Set(existingEmojis.map((e: any) => e.name));
    
    const idMap: Record<string, string> = {};
    for (const e of existingEmojis) {
      idMap[e.name] = e.id;
    }

    // 2. Upload new emojis
    let uploadedCount = 0;
    for (const [name, url] of Object.entries(EMOJI_SOURCES)) {
      if (existingNames.has(name)) {
        Logger.info(`Skipping ${name}: Already uploaded.`);
        continue;
      }

      Logger.info(`Downloading ${name} from emoji.gg...`);
      try {
        const imageBase64 = await getBase64Image(url);

        Logger.info(`Uploading ${name} to Discord API...`);
        const result: any = await rest.post(Routes.applicationEmojis(Config.clientId), {
          body: {
            name: name,
            image: imageBase64,
          },
        });

        idMap[name] = result.id;
        uploadedCount++;
        Logger.success(`Uploaded ${name} successfully! (ID: ${result.id})`);
      } catch (err: any) {
        Logger.error(`Failed to upload ${name}: ${err.message || err}`);
      }
    }

    Logger.divider();
    Logger.success(`Upload complete! Uploaded ${uploadedCount} new emojis.`);
    Logger.info(`Please copy the following map into your src/utils/emojis.ts file:`);
    console.log(JSON.stringify(idMap, null, 2));
    Logger.divider();

  } catch (error) {
    Logger.error(`Script failed: ${error}`);
  }
}

// Run the script
run();
