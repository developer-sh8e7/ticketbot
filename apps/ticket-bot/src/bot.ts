import { spawn, type ChildProcess } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createLogger, type BotFactory, type BotRuntimeOptions, type RunningBot } from '@opus/core';

const log = createLogger('ticket-bot');

// The legacy ticket worker starts its own Express health server on process.env.PORT.
// In production Railway sets PORT=8080 — the same port the orchestrator binds — so
// the inherited value made the worker grab 8080 and crash the orchestrator with
// EADDRINUSE (restart loop). Give each ticket worker its own unique internal port.
let nextHealthPort = 3101;

const SEED_GUILD_IDS = new Set(['1413059459630104626', '1395842846107631746']);

function cloneConfig(config: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(config)) as Record<string, unknown>;
}

function prepareRuntimeConfig(config: Record<string, unknown>, guildId: string): Record<string, unknown> {
  const prepared = cloneConfig(config);
  if (prepared.guild && typeof prepared.guild === 'object') {
    (prepared.guild as Record<string, unknown>).id = guildId;
  }

  if (!SEED_GUILD_IDS.has(guildId)) {
    if (prepared.roleProtection && typeof prepared.roleProtection === 'object') {
      (prepared.roleProtection as Record<string, unknown>).enabled = false;
    }
    if (prepared.roleManagement && typeof prepared.roleManagement === 'object') {
      (prepared.roleManagement as Record<string, unknown>).enabled = false;
    }
  }

  return prepared;
}

/**
 * A fresh guild has no saved server_configs row, so options.config is empty and
 * the legacy loader's strict schema would reject it and crash the worker (the
 * bot then shows offline). Fall back to a bundled, schema-valid default config
 * with the target guild id filled in.
 */
function resolveConfig(config: Record<string, unknown> | undefined, guildId: string): Record<string, unknown> {
  if (config && Object.keys(config).length > 0) return prepareRuntimeConfig(config, guildId);
  const defaultPath = fileURLToPath(new URL('../assets/default-config.json', import.meta.url));
  const def = JSON.parse(readFileSync(defaultPath, 'utf8')) as Record<string, unknown>;
  return prepareRuntimeConfig(def, guildId);
}

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
      const config = resolveConfig(options.config as Record<string, unknown> | undefined, options.guildId);
      writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
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
          // Unique internal health port — must not collide with the orchestrator's 8080.
          PORT: String(nextHealthPort++),
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
