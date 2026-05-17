// ══════════════════════════════════════════════════════════════
//  Event — ready
//  V2 — No Unicode emojis in status
// ══════════════════════════════════════════════════════════════

import { Client, ActivityType } from "discord.js";
import { Logger } from "../utils/logger";

export default {
  name: "clientReady" as const,
  once: true,
  execute(client: Client) {
    Logger.divider();
    Logger.success(`Logged in as ${client.user?.tag}`);
    Logger.info(`Serving ${client.guilds.cache.size} guild(s)`);
    Logger.info(`Watching ${client.users.cache.size} user(s)`);
    Logger.divider();

    // تفعيل حالة المشاهدة الرسمية والنظيفة
    client.user?.setActivity('Opus Solutions', { 
      type: ActivityType.Watching 
    });
  },
};
