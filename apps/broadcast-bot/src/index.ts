/**
 * Standalone entry for the owner's own server — `npm run dev -w @opus/broadcast-bot`.
 * Runs a single instance via the same factory the orchestrator uses, plus a health
 * server so hosting platforms mark it healthy. NOT required for selling — the
 * orchestrator spawns the factory directly for paying customers.
 */
import { createServer } from 'node:http';
import { config as loadDotenv } from 'dotenv';
import { createBroadcastBot } from './bot.js';

loadDotenv();

const REQUIRED_VARS = ['BROADCAST_DEV_TOKEN', 'BROADCAST_DEV_GUILD'] as const;
const OPTIONAL_VARS = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'DISCORD_CLIENT_ID', 'WEB_PORT'] as const;

function logEnvDiagnostics() {
  console.log('[broadcast-bot] --- env diagnostics ---');
  for (const name of REQUIRED_VARS) {
    console.log(`[broadcast-bot]   ${name}: ${process.env[name] ? 'present' : 'MISSING ⚠'}`);
  }
  for (const name of OPTIONAL_VARS) {
    console.log(`[broadcast-bot]   ${name}: ${process.env[name] ? 'present' : 'not set'}`);
  }
  console.log('[broadcast-bot] --- end diagnostics ---');
}

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
  logEnvDiagnostics();

  const token = process.env.BROADCAST_DEV_TOKEN;
  const guildId = process.env.BROADCAST_DEV_GUILD;
  if (!token) throw new Error('[broadcast-bot] BROADCAST_DEV_TOKEN is required — set it to the Discord bot token.');
  if (!guildId) throw new Error('[broadcast-bot] BROADCAST_DEV_GUILD is required — set it to your Discord guild ID.');

  startHealthServer();

  const bot = createBroadcastBot({
    token,
    guildId,
    ownerId: process.env.BROADCAST_DEV_OWNER ?? 'owner',
    instanceId: 'dev-standalone',
    config: { clientId: process.env.DISCORD_CLIENT_ID ?? '' },
    supabaseUrl: process.env.SUPABASE_URL ?? '',
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  });

  await bot.start();
  console.log('[broadcast-bot] instance started');

  const shutdown = async () => {
    console.log('[broadcast-bot] shutting down');
    await bot.stop();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((error) => {
  console.error('[broadcast-bot] fatal:', error instanceof Error ? error.message : error);
  process.exit(1);
});
