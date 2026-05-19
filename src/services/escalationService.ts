import { Client, ChannelType, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import type { TicketRepository } from '../database/ticketRepository.js';
import { logger } from '../utils/logger.js';

export class EscalationService {
  private checkInterval: NodeJS.Timeout | null = null;

  public constructor(
    private readonly client: Client,
    private readonly ticketRepository: TicketRepository,
    private readonly config: any
  ) {}

  public start(): void {
    if (this.checkInterval) return;
    
    logger.info('Starting Middleman Ticket Escalation Scheduler (runs every 1 minute)...');
    this.checkInterval = setInterval(() => {
      this.checkEscalations().catch((err) => {
        logger.error('Error during ticket escalation check:', err);
      });
    }, 60000); // 1 minute
  }

  public stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      logger.info('Stopped Middleman Ticket Escalation Scheduler.');
    }
  }

  private async checkEscalations(): Promise<void> {
    const guildId = this.config.guild.guildId;
    if (!guildId) return;

    const guild = await this.client.guilds.fetch(guildId).catch(() => null);
    if (!guild) return;

    // Fetch all open tickets
    const openTickets = await this.ticketRepository.findOpenTickets(guildId);
    
    // Filter tickets:
    // 1. category_key must be 'middleman'
    // 2. claimed_by must be null (unclaimed)
    // 3. metadata.escalated must not be true
    // 4. opened_at must be older than 2 hours
    const eligibleTickets = openTickets.filter((ticket) => {
      if (ticket.category_key !== 'middleman') return false;
      if (ticket.claimed_by !== null) return false;
      if (ticket.metadata?.escalated === true) return false;
      
      const openedAt = new Date(ticket.opened_at).getTime();
      const hoursPassed = (Date.now() - openedAt) / (1000 * 60 * 60);
      return hoursPassed >= 2; // 2 hours
    });

    for (const ticket of eligibleTickets) {
      try {
        const channelId = ticket.channel_id;
        if (!channelId) continue;
        const channel = await guild.channels.fetch(channelId).catch(() => null);
        if (!channel || channel.type !== ChannelType.GuildText) continue;

        // Extract trade amount from answers
        const tradeAmountAnswer = ticket.answers.find((ans) => ans.key === 'trade_amount')?.value;
        if (!tradeAmountAnswer) continue;

        // We import parseTradeAmount locally to avoid circular dependency
        const { parseTradeAmount } = await import('../utils/text.js');
        const tradeAmount = parseTradeAmount(tradeAmountAnswer);
        if (typeof tradeAmount !== 'number') continue;

        const NEW_MM = "1506010346777874472";
        const MEDIUM_MM = "1506010306407694346";
        const GUARANTEED_MM = "1506009944053387264";

        let roleToEscalate: string | null = null;
        let messageText = '';

        if (tradeAmount > 250) {
          // Guaranteed ticket: Escalate to Medium (allow them to write)
          roleToEscalate = MEDIUM_MM;
          messageText = `⚠️ **تنبيه تصعيد التذكرة (مرت ساعتان):**\nمرت ساعتان كاملتان ولم يتم استلام التذكرة من قبل وسطاء مضمونين. تم الآن تفعيل صلاحية الكتابة والمشاركة للوسطاء المتوسطين <@&${MEDIUM_MM}> لتسهيل عملية الاستلام وإتمام التريد!`;
        } else if (tradeAmount > 50 && tradeAmount <= 250) {
          // Medium ticket: Escalate to New (allow them to write)
          roleToEscalate = NEW_MM;
          messageText = `⚠️ **تنبيه تصعيد التذكرة (مرت ساعتان):**\nمرت ساعتان كاملتان ولم يتم استلام التذكرة من قبل وسطاء متوسطين. تم الآن تفعيل صلاحية الكتابة والمشاركة للوسطاء الجدد <@&${NEW_MM}> لتسهيل عملية الاستلام وإتمام التريد!`;
        }

        if (roleToEscalate && guild.roles.cache.has(roleToEscalate)) {
          logger.info(`Escalating ticket #${ticket.ticket_number} (Channel: ${channel.name}) to role: ${roleToEscalate}`);

          // Update permission overwrites to allow SendMessages for the escalated role
          await channel.permissionOverwrites.edit(roleToEscalate, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true,
            AttachFiles: true,
            EmbedLinks: true,
          });

          // Send notification message with a beautiful embed
          const embed = new EmbedBuilder()
            .setColor(0xFFAA00)
            .setTitle('⚠️ تصعيد التذكرة التلقائي | Ticket Escalation')
            .setDescription(messageText)
            .setTimestamp();

          await channel.send({
            content: `<@&${roleToEscalate}>`,
            embeds: [embed],
            allowedMentions: { roles: [roleToEscalate] },
          });

          // Update metadata in DB to prevent repeated escalation
          const updatedMetadata = {
            ...(ticket.metadata || {}),
            escalated: true,
            escalatedAt: new Date().toISOString(),
            escalatedToRole: roleToEscalate,
          };

          await this.ticketRepository.updateMetadata(channelId, updatedMetadata);
        }
      } catch (err) {
        logger.error(`Failed to process escalation for ticket #${ticket.ticket_number}:`, err);
      }
    }
  }
}
