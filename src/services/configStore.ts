import { loadConfig } from '../config/loadConfig.js';
import type { AppConfig, EmojiConfig, GuildConfig, PanelConfig } from '../types/config.js';

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

  public patchEmojis(categoryEmojis: Record<string, string>, buttonEmojis: Record<string, string>): void {
    this.config = {
      ...this.config,
      emojis: {
        ...this.config.emojis,
        categories: { ...this.config.emojis.categories, ...categoryEmojis },
      },
      ticket: {
        ...this.config.ticket,
        controls: {
          close: { ...this.config.ticket.controls.close, emojiId: buttonEmojis.close || this.config.ticket.controls.close.emojiId },
          add: { ...this.config.ticket.controls.add, emojiId: buttonEmojis.add || this.config.ticket.controls.add.emojiId },
          remove: { ...this.config.ticket.controls.remove, emojiId: buttonEmojis.remove || this.config.ticket.controls.remove.emojiId },
          claim: { ...this.config.ticket.controls.claim, emojiId: buttonEmojis.claim || this.config.ticket.controls.claim.emojiId },
          pin: { ...this.config.ticket.controls.pin, emojiId: buttonEmojis.pin || this.config.ticket.controls.pin.emojiId },
        },
      },
    };
  }
}
