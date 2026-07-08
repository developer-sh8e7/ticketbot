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
    const guildId = this.config.guild.id;
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
        // Escalation is no longer needed for middleman tickets with a single role tier
        // All support staff have write access by default
      } catch (err) {
        logger.error(`Failed to process escalation for ticket #${ticket.ticket_number}:`, err);
      }
    }
  }
}
