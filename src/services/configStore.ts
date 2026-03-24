import { loadConfig } from '../config/loadConfig.js';
import type { AppConfig, GuildConfig, PanelConfig } from '../types/config.js';

export class ConfigStore {
  private config: AppConfig;

  public constructor(private readonly configPath: string) {
    this.config = loadConfig(configPath);
  }

  public get current(): AppConfig {
    return this.config;
  }

  public reload(): AppConfig {
    this.config = loadConfig(this.configPath);
    return this.config;
  }

  public patchGuild(patch: Partial<GuildConfig>): void {
    this.config = {
      ...this.config,
      guild: { ...this.config.guild, ...patch },
    };
  }

  public patchPanel(patch: Partial<PanelConfig>): void {
    this.config = {
      ...this.config,
      panel: { ...this.config.panel, ...patch },
    };
  }
}
