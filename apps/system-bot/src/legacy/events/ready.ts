// ══════════════════════════════════════════════════════════════
//  Event — ready
//  V2 — No Unicode emojis in status
// ══════════════════════════════════════════════════════════════

import { Client, ActivityType } from "discord.js";
import { Logger } from "../utils/logger.js";

export default {
  name: "clientReady" as const,
  once: true,
  execute(client: Client) {
    Logger.divider();
    Logger.success(`Logged in as ${client.user?.tag}`);
    Logger.info(`Serving ${client.guilds.cache.size} guild(s)`);
    Logger.info(`Watching ${client.users.cache.size} user(s)`);
    Logger.divider();

    // Rotating status
    const statuses = [
      { type: ActivityType.Watching, name: "{members} members" },
      { type: ActivityType.Playing, name: "/help | V2" },
      { type: ActivityType.Watching, name: "{guilds} servers" },
      { type: ActivityType.Listening, name: "Opus Solutions" },
    ];

    let idx = 0;
    const setStatus = () => {
      const s = statuses[idx % statuses.length]!;
      const name = s.name
        .replace("{members}", String(client.guilds.cache.reduce((a, g) => a + g.memberCount, 0)))
        .replace("{guilds}", String(client.guilds.cache.size));

      client.user?.setActivity(name, { type: s.type });
      idx++;
    };

    setStatus();
    setInterval(setStatus, 15_000);
  },
};
