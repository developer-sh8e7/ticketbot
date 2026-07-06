import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../config/loadConfig.js';
import type { AppConfig, GuildConfig, PanelConfig } from '../types/config.js';

type PersistConfig = (guildId: string, config: AppConfig) => void | Promise<void>;

export class ConfigStore {
  private configs: Map<string, AppConfig> = new Map();
  private configPaths: Map<string, string> = new Map();
  private defaultConfig: AppConfig;
  private readonly rootPath: string;
  private readonly isDirectory: boolean;

  public constructor(configPath: string, private readonly onSave?: PersistConfig) {
    this.rootPath = configPath;
    this.isDirectory = fs.existsSync(configPath) && fs.statSync(configPath).isDirectory();

    if (this.isDirectory) {
      const defaultPath = path.join(configPath, 'config.json');
      this.defaultConfig = loadConfig(defaultPath);
      this.setLoadedConfig(this.defaultConfig, defaultPath);

      try {
        const files = fs.readdirSync(configPath).filter(f => /^config_\d+\.json$/.test(f));
        for (const file of files) {
          try {
            const configPath2 = path.join(configPath, file);
            const config = loadConfig(configPath2);
            if (config.guild.id) {
              this.setLoadedConfig(config, configPath2);
              console.log(`[ConfigStore] Loaded config for guild ${config.guild.id}`);
            }
          } catch (err) {
            console.error(`[ConfigStore] Failed to load ${file}:`, err);
          }
        }
      } catch (err) {
        console.error('[ConfigStore] Failed to scan config directory:', err);
      }
    } else {
      this.defaultConfig = loadConfig(configPath);
      this.setLoadedConfig(this.defaultConfig, configPath);
    }
  }

  private setLoadedConfig(config: AppConfig, configPath: string): void {
    const key = config.guild.id || 'default';
    this.configs.set(key, config);
    this.configPaths.set(key, configPath);
  }

  /** Get config for a specific guild, falling back to default */
  public get(guildId: string): AppConfig {
    return this.configs.get(guildId) ?? this.defaultConfig;
  }

  /** Get config for a specific guild or null if not found */
  public getOrNull(guildId: string): AppConfig | null {
    return this.configs.get(guildId) ?? null;
  }

  public all(): AppConfig[] {
    return [...this.configs.values()];
  }

  /** Legacy: returns first loaded config (for backward compatibility) */
  public get current(): AppConfig {
    return this.defaultConfig;
  }

  public reload(): AppConfig {
    this.configs.clear();
    this.configPaths.clear();

    if (this.isDirectory) {
      const defaultPath = path.join(this.rootPath, 'config.json');
      this.defaultConfig = loadConfig(defaultPath);
      this.setLoadedConfig(this.defaultConfig, defaultPath);

      try {
        const files = fs.readdirSync(this.rootPath).filter(f => /^config_\d+\.json$/.test(f));
        for (const file of files) {
          try {
            const configPath = path.join(this.rootPath, file);
            const config = loadConfig(configPath);
            if (config.guild.id) {
              this.setLoadedConfig(config, configPath);
            }
          } catch (err) {
            console.error(`[ConfigStore] Failed to reload ${file}:`, err);
          }
        }
      } catch (err) {
        console.error('[ConfigStore] Failed to scan config directory during reload:', err);
      }
    } else {
      this.defaultConfig = loadConfig(this.rootPath);
      this.setLoadedConfig(this.defaultConfig, this.rootPath);
    }

    return this.defaultConfig;
  }

  private persist(guildId: string, config: AppConfig): void {
    if (!this.onSave) return;
    try {
      void Promise.resolve(this.onSave(guildId, config)).catch((error) => {
        console.error(`[ConfigStore] Failed to persist config for guild ${guildId}:`, error);
      });
    } catch (error) {
      console.error(`[ConfigStore] Failed to persist config for guild ${guildId}:`, error);
    }
  }

  public save(guildId: string): void {
    const config = this.get(guildId);
    const configPath = this.configPaths.get(guildId) ?? this.configPaths.get(config.guild.id || 'default') ?? this.rootPath;
    const dir = path.dirname(configPath);
    fs.mkdirSync(dir, { recursive: true });

    const tmpPath = `${configPath}.${process.pid}.${Date.now()}.tmp`;
    const backupPath = `${configPath}.bak`;
    if (fs.existsSync(configPath)) {
      fs.copyFileSync(configPath, backupPath);
    }
    fs.writeFileSync(tmpPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
    fs.renameSync(tmpPath, configPath);
    this.persist(guildId, config);
  }

  public update(guildId: string, updater: (config: AppConfig) => AppConfig): AppConfig {
    const current = this.get(guildId);
    const updated = updater(current);
    this.configs.set(guildId, updated);
    if (this.defaultConfig.guild.id === guildId) {
      this.defaultConfig = updated;
    }
    this.save(guildId);
    return updated;
  }

  public patchGuild(guildId: string, patch: Partial<GuildConfig>): void {
    const config = this.get(guildId);
    const updated = { ...config, guild: { ...config.guild, ...patch } };
    this.configs.set(guildId, updated);
    if (this.defaultConfig.guild.id === guildId) {
      this.defaultConfig = updated;
    }
  }

  public patchPanel(guildId: string, patch: Partial<PanelConfig>): void {
    const config = this.get(guildId);
    const updated = { ...config, panel: { ...config.panel, ...patch } };
    this.configs.set(guildId, updated);
    if (this.defaultConfig.guild.id === guildId) {
      this.defaultConfig = updated;
    }
  }

  public patchEmojis(guildId: string, categoryEmojis: Record<string, string>, buttonEmojis: Record<string, string>): void {
    const config = this.get(guildId);
    const pick = (configValue: string, autoValue: string | undefined) => configValue || autoValue || '';

    const mergedCategories: Record<string, string> = { ...categoryEmojis };
    for (const [key, value] of Object.entries(config.emojis.categories)) {
      if (value) mergedCategories[key] = value;
    }

    const updated: AppConfig = {
      ...config,
      emojis: {
        ...config.emojis,
        categories: mergedCategories,
      },
      ticket: {
        ...config.ticket,
        controls: {
          close: { ...config.ticket.controls.close, emojiId: pick(config.ticket.controls.close.emojiId, buttonEmojis.close) },
          add: { ...config.ticket.controls.add, emojiId: pick(config.ticket.controls.add.emojiId, buttonEmojis.add) },
          remove: { ...config.ticket.controls.remove, emojiId: pick(config.ticket.controls.remove.emojiId, buttonEmojis.remove) },
          claim: { ...config.ticket.controls.claim, emojiId: pick(config.ticket.controls.claim.emojiId, buttonEmojis.claim) },
          pin: { ...config.ticket.controls.pin, emojiId: pick(config.ticket.controls.pin.emojiId, buttonEmojis.pin) },
          stats: { ...config.ticket.controls.stats, emojiId: pick(config.ticket.controls.stats.emojiId, buttonEmojis.stats) },
        },
      },
    };
    this.configs.set(guildId, updated);
    if (this.defaultConfig.guild.id === guildId) {
      this.defaultConfig = updated;
    }
  }
}
