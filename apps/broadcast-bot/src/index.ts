/**
 * Standalone entry for the owner's own server — `npm run dev -w @opus/broadcast-bot`.
 * Runs the bot in-process (no child spawn) so it works the same on Windows/macOS/Linux.
 * Only needs BROADCAST_DEV_TOKEN + BROADCAST_DEV_GUILD. Supabase / client id are NOT
 * used here — those belong to the sold (orchestrator) path only.
 */
import { createServer } from 'node:http';
import { config as loadDotenv } from 'dotenv';
import { startRuntime } from './runtime.js';

loadDotenv();

function startHealthServer() {
  const port = Number(process.env.PORT ?? process.env.WEB_PORT ?? 3000);
  const server = createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');
  });
  server.listen(port, () => console.log(`[broadcast-bot] health server on port ${port}`));
  return server;
}

async function main() {
  console.log('[broadcast-bot] starting up');

  const token = process.env.BROADCAST_DEV_TOKEN;
  const guildId = process.env.BROADCAST_DEV_GUILD;
  console.log(`[broadcast-bot]   BROADCAST_DEV_TOKEN: ${token ? 'present' : 'MISSING ⚠'}`);
  console.log(`[broadcast-bot]   BROADCAST_DEV_GUILD: ${guildId ? 'present' : 'MISSING ⚠'}`);
  if (!token) throw new Error('[broadcast-bot] BROADCAST_DEV_TOKEN is required — set it to the Discord bot token.');
  if (!guildId) throw new Error('[broadcast-bot] BROADCAST_DEV_GUILD is required — set it to your Discord guild ID.');

  // startRuntime reads BOT_TOKEN / GUILD_ID — feed it the dev values in-process.
  process.env.BOT_TOKEN = token;
  process.env.GUILD_ID = guildId;

  startHealthServer();
  await startRuntime();
  console.log('[broadcast-bot] instance started');
}

main().catch((error) => {
  console.error('[broadcast-bot] fatal:', error instanceof Error ? error.message : error);
  process.exit(1);
});
