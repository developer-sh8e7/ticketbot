import { Message } from 'discord.js';
import type { TicketRecord } from '../database/types.js';
import { logger } from '../utils/logger.js';

export class AIService {
  public constructor(private readonly apiKey?: string) {}

  public async handleTicketMessage(message: Message, ticket: TicketRecord): Promise<void> {
    if (!this.apiKey) {
      return;
    }

    // Rule: AI only responds to non-bot messages
    if (message.author.bot) return;

    // Rule: AI is active only for UNCLAIMED tickets to avoid interfering with human staff
    if (ticket.claimed_by !== null) {
      return;
    }

    try {
      // Trigger typing effect to show the AI is thinking
      if (message.channel && 'sendTyping' in message.channel && typeof message.channel.sendTyping === 'function') {
        await message.channel.sendTyping().catch(() => null);
      }

      // Fetch the last 15 messages in the channel to construct conversation history
      const channelMessages = await message.channel.messages.fetch({ limit: 15 }).catch(() => null);
      if (!channelMessages) return;

      const history = Array.from(channelMessages.values())
        .reverse()
        .map((m) => `${m.author.bot ? 'AI' : m.author.username}: ${m.content}`)
        .join('\n');

      const ticketAnswersText = ticket.answers
        .map((ans) => `- ${ans.label || ans.key}: ${ans.value}`)
        .join('\n');

      const systemInstruction = `You are a polite, extremely helpful, and elite AI Support Assistant for the "Steal the Brainrot (STB)" Discord server.
The user is inside their ticket channel.
Ticket Category: ${ticket.category_label || ticket.category_key}
Answers provided by the user when opening this ticket:
${ticketAnswersText}

Currently, the ticket is UNCLAIMED. A human support agent or middleman (وسيط) is on their way.
Your job is to chat with the user, answer their questions, guide them, and keep them warm and polite.
You must:
1. Always respond in the same language as the user's last message (if they write in Arabic, respond in fluent, warm, and polite Arabic).
2. Acknowledge their message naturally. If they greet you (e.g. "السلام عليكم"), greet them back warmly.
3. If they ask why the bot or support hasn't responded yet, politely explain that a human middleman (وسيط) is on their way, and you (the AI assistant) are here to help them in the meantime.
4. Keep your responses natural, friendly, clear, and under 3-4 sentences. Do not use markdown headers, just clean formatted text.
5. If the user uses colloquial, impatient, or informal language (like "حمار انت" or "ليش ما يسوي شيء"), respond with high patience, extreme politeness, and absolute class, maintaining a professional but very friendly tone. Never be defensive.`;

      const prompt = `System Instructions:\n${systemInstruction}\n\nRecent Channel Chat History:\n${history}\n\nAI Response:`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt }
              ]
            }
          ]
        }),
        signal: AbortSignal.timeout(10000), // 10 seconds timeout
      });

      if (response.ok) {
        const data = await response.json();
        const aiResponseText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

        if (aiResponseText) {
          // Send the response back to the channel
          await message.reply({
            content: aiResponseText,
            allowedMentions: { repliedUser: true },
          });
        }
      } else {
        logger.error(`Gemini API returned error status: ${response.status}`);
      }
    } catch (err) {
      logger.error('Failed to process message with Gemini AI Ticket Assistant:', err);
    }
  }
}
