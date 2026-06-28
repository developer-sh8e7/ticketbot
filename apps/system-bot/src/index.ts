import { createServer } from 'node:http';
import { createSystemBot } from './bot.js';

// Safe startup diagnostics — logs presence of each variable without printing its value.
const REQUIRED_VARS = ['GENERAL_DEV_TOKEN', 'GENERAL_DEV_GUILD', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] as const;
const OPTIONAL_VARS = ['DISCORD_CLIENT_ID', 'GENERAL_DEV_OWNER', 'WEB_PORT'] as const;

function logEnvDiagnostics() {
  console.log('[system-bot] --- env diagnostics ---');
  for (const name of REQUIRED_VARS) {
    console.log(`[system-bot]   ${name}: ${process.env[name] ? 'present' : 'MISSING ⚠'}`);
  }
  for (const name of OPTIONAL_VARS) {
    console.log(`[system-bot]   ${name}: ${process.env[name] ? 'present' : 'not set'}`);
  }
  console.log('[system-bot] --- end diagnostics ---');
}

/** Minimal HTTP health server so Railway marks the deployment healthy. */
function startHealthServer() {
  const port = Number(process.env.PORT ?? process.env.WEB_PORT ?? 3000);
  const server = createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');
  });
  server.listen(port, () => {
    console.log(`[system-bot] health server listening on port ${port}`);
  });
  return server;
}

async function main() {
  console.log('[system-bot] starting up');
  logEnvDiagnostics();

  const token  = process.env.GENERAL_DEV_TOKEN;
  const guildId = process.env.GENERAL_DEV_GUILD;

  if (!token)   throw new Error('[system-bot] GENERAL_DEV_TOKEN is required — set it to the Discord bot token.');
  if (!guildId) throw new Error('[system-bot] GENERAL_DEV_GUILD is required — set it to the main Discord guild ID.');

  startHealthServer();

  const bot = createSystemBot({
    token,
    guildId,
    ownerId: process.env.GENERAL_DEV_OWNER ?? 'dev',
    instanceId: 'dev-instance',
    config: {},
    supabaseUrl: process.env.SUPABASE_URL ?? '',
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  });

  const { botUserId } = await bot.start();
  console.log(`[system-bot] worker process launched (botUserId="${botUserId}")`);

  process.on('SIGINT',  () => bot.stop().then(() => process.exit(0)));
  process.on('SIGTERM', () => bot.stop().then(() => process.exit(0)));
}

main().catch((err: unknown) => {
  console.error('[system-bot] fatal startup error:', err);
  process.exit(1);
});
