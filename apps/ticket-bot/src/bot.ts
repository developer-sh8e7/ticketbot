import { spawn, type ChildProcess } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createLogger, type BotFactory, type BotRuntimeOptions, type RunningBot } from '@opus/core';

const log = createLogger('ticket-bot');

function legacyEntry(): string {
  return process.env.NODE_ENV === 'production' || import.meta.url.includes('/dist/')
    ? new URL('./legacy/index.js', import.meta.url).pathname
    : new URL('./legacy/index.ts', import.meta.url).pathname;
}

function commandFor(entry: string): { cmd: string; args: string[] } {
  return entry.endsWith('.ts') ? { cmd: 'npx', args: ['tsx', entry] } : { cmd: process.execPath, args: [entry] };
}

/**
 * Ticket Bot factory.
 *
 * The complete legacy Ticket runtime from C:/Users/pkg/Downloads/Ticket/src is kept under
 * src/legacy and executed as an isolated per-instance worker. This preserves the original
 * ticket, mediator, escalation, transcript, panel, role-protection, vouches, welcome,
 * temp-room and config logic while the SaaS orchestrator owns subscription/token lifecycle.
 */
export const createTicketBot: BotFactory = (options: BotRuntimeOptions): RunningBot => {
  let child: ChildProcess | null = null;
  const runtimeDir = join(tmpdir(), 'opus-solutions', options.instanceId);
  const configPath = join(runtimeDir, `config_${options.guildId}.json`);

  return {
    productType: 'ticket',
    instanceId: options.instanceId,
    async start() {
      mkdirSync(runtimeDir, { recursive: true });
      writeFileSync(configPath, JSON.stringify(options.config ?? {}, null, 2), 'utf8');
      const entry = legacyEntry();
      const { cmd, args } = commandFor(entry);
      child = spawn(cmd, args, {
        cwd: new URL('..', import.meta.url).pathname,
        env: {
          ...process.env,
          RUN_MODE: 'legacy',
          DISCORD_TOKEN: options.token,
          SUPABASE_URL: options.supabaseUrl,
          SUPABASE_SERVICE_ROLE_KEY: options.supabaseServiceRoleKey,
          CONFIG_PATH: configPath,
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      child.stdout?.on('data', (chunk) => log.info(String(chunk).replace(options.token, '[redacted]').trim()));
      child.stderr?.on('data', (chunk) => log.error(String(chunk).replace(options.token, '[redacted]').trim()));
      child.on('exit', (code, signal) => log.warn(`Ticket worker ${options.instanceId} exited code=${code} signal=${signal}`));
      return { botUserId: '' };
    },
    async stop() {
      if (child && !child.killed) child.kill('SIGTERM');
      child = null;
      rmSync(runtimeDir, { recursive: true, force: true });
    },
  };
};

export default createTicketBot;
