import { AttachmentBuilder, ChannelType, type GuildMember } from 'discord.js';
import sharp from 'sharp';
import { logger } from '../utils/logger.js';

const WELCOME_CHANNEL_ID = '1483606109284470844';
const WELCOME_OWNER_ID = '959896496113844254';
const WELCOME_BACKGROUND_URL = 'https://i.imgur.com/RXveNTb.png';
const AVATAR_SIZE = 330;
const AVATAR_CENTER_X_RATIO = 0.5;
const AVATAR_CENTER_Y_RATIO = 552 / 941;

export class WelcomeService {
  private background: Buffer | null = null;

  public async handleMemberAdd(member: GuildMember): Promise<void> {
    if (member.user.bot) return;

    const channel = await member.guild.channels.fetch(WELCOME_CHANNEL_ID).catch(() => null);
    if (!channel || (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement)) return;

    const image = await this.buildWelcomeImage(member);
    const attachment = new AttachmentBuilder(image, { name: 'welcome.png' });

    await channel.send({
      content: `*hey :* **<@${member.id}>**\nWelcome to STB Arab\n*by :* **<@${WELCOME_OWNER_ID}>**`,
      files: [attachment],
    }).catch((error) => {
      logger.warn('Failed to send welcome message', error instanceof Error ? error.message : error);
    });
  }

  private async buildWelcomeImage(member: GuildMember): Promise<Buffer> {
    const [background, avatar] = await Promise.all([
      this.getBackground(),
      this.getCircularAvatar(member),
    ]);

    const metadata = await sharp(background).metadata();
    const width = metadata.width ?? 1672;
    const height = metadata.height ?? 941;
    const left = Math.round((width * AVATAR_CENTER_X_RATIO) - (AVATAR_SIZE / 2));
    const top = Math.round((height * AVATAR_CENTER_Y_RATIO) - (AVATAR_SIZE / 2));

    return sharp(background)
      .composite([{ input: avatar, left, top }])
      .png()
      .toBuffer();
  }

  private async getBackground(): Promise<Buffer> {
    if (this.background) return this.background;

    this.background = await this.fetchBuffer(WELCOME_BACKGROUND_URL);
    return this.background;
  }

  private async getCircularAvatar(member: GuildMember): Promise<Buffer> {
    const avatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 512 });
    const avatar = await this.fetchBuffer(avatarUrl);
    const mask = Buffer.from(
      `<svg width="${AVATAR_SIZE}" height="${AVATAR_SIZE}"><circle cx="${AVATAR_SIZE / 2}" cy="${AVATAR_SIZE / 2}" r="${AVATAR_SIZE / 2}" fill="#fff"/></svg>`,
    );

    return sharp(avatar)
      .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: 'cover' })
      .composite([{ input: mask, blend: 'dest-in' }])
      .png()
      .toBuffer();
  }

  private async fetchBuffer(url: string): Promise<Buffer> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch welcome image asset: ${response.status}`);
    }

    return Buffer.from(await response.arrayBuffer());
  }
}
