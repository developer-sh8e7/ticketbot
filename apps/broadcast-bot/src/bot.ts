import { spawn, type ChildProcess } from 'node:child_process';
import { createLogger, type BotFactory, type BotRuntimeOptions, type RunningBot } from '@opus/core';

const log = createLogger('broadcast-bot');

function runtimeEntry(): string {
  return process.env.NODE_ENV === 'production' || import.meta.url.includes('/dist/')
    ? new URL('./runtime.js', import.meta.url).pathname
    : new URL('./runtime.ts', import.meta.url).pathname;
}

function commandFor(entry: string): { cmd: string; args: string[] } {
  return entry.endsWith('.ts') ? { cmd: 'npx', args: ['tsx', entry] } : { cmd: process.execPath, args: [entry] };
}

/** Broadcast Bot factory. Spawns the DM-broadcast runtime per SaaS instance. */
export const createBroadcastBot: BotFactory = (options: BotRuntimeOptions): RunningBot => {
  let child: ChildProcess | null = null;
  return {
    productType: 'broadcast',
    instanceId: options.instanceId,
    async start() {
      const entry = runtimeEntry();
      const { cmd, args } = commandFor(entry);
      const config = options.config as Record<string, unknown>;
      child = spawn(cmd, args, {
        cwd: new URL('..', import.meta.url).pathname,
        env: {
          ...process.env,
          BOT_TOKEN: options.token,
          CLIENT_ID: String(config.clientId ?? process.env.DISCORD_CLIENT_ID ?? process.env.CLIENT_ID ?? ''),
          GUILD_ID: options.guildId,
          INSTANCE_ID: options.instanceId,
          SUPABASE_URL: options.supabaseUrl,
          SUPABASE_KEY: options.supabaseServiceRoleKey,
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      child.stdout?.on('data', (chunk) => log.info(String(chunk).replace(options.token, '[redacted]').trim()));
      child.stderr?.on('data', (chunk) => log.error(String(chunk).replace(options.token, '[redacted]').trim()));
      child.on('exit', (code, signal) => log.warn(`Broadcast worker ${options.instanceId} exited code=${code} signal=${signal}`));
      return { botUserId: '' };
    },
    async stop() {
      if (child && !child.killed) child.kill('SIGTERM');
      child = null;
    },
  };
};

export default createBroadcastBot;
