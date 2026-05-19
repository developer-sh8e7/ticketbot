import { Message, ChannelType } from 'discord.js';
import type { TicketRecord } from '../database/types.js';
import { logger } from '../utils/logger.js';
import { padTicketNumber } from '../utils/text.js';

export class AIService {
  public constructor(
    private readonly apiKey: string | undefined,
    private readonly ticketRepository: any
  ) {}

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
      const guild = message.guild;
      if (!guild) return;

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

---
🔴 IMPORTANT STB FORTNITE ITEM PRICES:
The STB (Steal the Brainrot) Fortnite map has an active trading economy for its in-game collectible characters. When asked about prices, provide these precise market values:
1. **Default Dragon (الدراقوني كللانوني الديفولت / دراقون ديفولت):** OG Legendary character, extremely rare and highly desired. Trades in the range of **100$ to 150$**.
2. **Spider (سبايدر):** Very popular rare/epic character. Trades in the range of **15$ to 25$**.
3. **Boneca Ambalabu (بونيكا أمبالابو):** Legendary doll, trades in the range of **40$ to 80$**.
4. **Titan TV Man (تيتان تي في مان) / Pipi Potato (بيبي بطاطس) / Cornzilla (كورن زيلا):** Epic tier, trades around **10$ to 35$**.
5. **Skibidi Toilet (سكيبيدي تواليت):** Rare tier, worth around **2$ to 8$**.
6. **Common/Uncommon (Floppa, Nugget, Maxwell, Pepe, Gigachad, Sigma):** Worth **0.5$ to 2$** or used as filler.

---
🔴 IMPORTANT AGENTIC ACTION CAPABILITY:
You have the power to actually modify the ticket's trade amount, rename the channel, and dynamically update permissions/roles!
If the user indicates they typed the trade amount wrong, want to change the trade amount, or request to route/transfer the ticket to a new middleman tier, you must evaluate the new trade amount and append a structured JSON action at the very end of your response inside a block like this:
\`||ACTION:{"action": "update_trade_amount", "amount": number}||\`
(e.g., if they say "أنا كتبت التريد 300$ بالغلط التريد حقي 50$ حول لوسيط جديد", you respond politely in Arabic explaining that you are updating it, and append: \`||ACTION:{"action": "update_trade_amount", "amount": 50}||\` at the very end).

---
GENERAL RULES:
1. Always respond in the same language as the user's last message (if they write in Arabic, respond in fluent, warm, and polite Arabic).
2. Acknowledge their message naturally.
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
        let aiResponseText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

        if (aiResponseText) {
          // Parse Action if present
          const actionRegex = /\|\|ACTION:(\{[\s\S]*?\})\|\|/;
          const actionMatch = aiResponseText.match(actionRegex);

          if (actionMatch) {
            try {
              const actionObj = JSON.parse(actionMatch[1]);
              
              if (actionObj.action === 'update_trade_amount' && typeof actionObj.amount === 'number') {
                const newAmount = actionObj.amount;

                // 1. Update the Supabase Database Answers
                const updatedAnswers = ticket.answers.map((ans) => {
                  if (ans.key === 'trade_amount') {
                    return { ...ans, value: String(newAmount) };
                  }
                  return ans;
                });
                await this.ticketRepository.updateAnswers(ticket.channel_id, updatedAnswers);

                // 2. Re-calculate permissions & channel names
                const NEW_MM = "1506010346777874472";
                const MEDIUM_MM = "1506010306407694346";
                const GUARANTEED_MM = "1506009944053387264";

                const padLen = 4;
                const ticketNumStr = padTicketNumber(ticket.ticket_number, padLen);

                let newName = '';
                const txtChannel = message.channel as any;
                if (txtChannel && typeof txtChannel.permissionOverwrites === 'object') {
                  if (newAmount <= 50) {
                    newName = `وسيط-جديد-${ticketNumStr}`;
                    // All allowed to write
                    if (guild.roles.cache.has(NEW_MM)) {
                      await txtChannel.permissionOverwrites.edit(NEW_MM, { SendMessages: true, ViewChannel: true, ReadMessageHistory: true }).catch(() => null);
                    }
                    if (guild.roles.cache.has(MEDIUM_MM)) {
                      await txtChannel.permissionOverwrites.edit(MEDIUM_MM, { SendMessages: true, ViewChannel: true, ReadMessageHistory: true }).catch(() => null);
                    }
                    if (guild.roles.cache.has(GUARANTEED_MM)) {
                      await txtChannel.permissionOverwrites.edit(GUARANTEED_MM, { SendMessages: true, ViewChannel: true, ReadMessageHistory: true }).catch(() => null);
                    }
                  } else if (newAmount > 50 && newAmount <= 250) {
                    newName = `وسيط-متوسط-${ticketNumStr}`;
                    // Medium & Guaranteed write. New MM is view-only
                    if (guild.roles.cache.has(NEW_MM)) {
                      await txtChannel.permissionOverwrites.edit(NEW_MM, { SendMessages: false, ViewChannel: true, ReadMessageHistory: true }).catch(() => null);
                    }
                    if (guild.roles.cache.has(MEDIUM_MM)) {
                      await txtChannel.permissionOverwrites.edit(MEDIUM_MM, { SendMessages: true, ViewChannel: true, ReadMessageHistory: true }).catch(() => null);
                    }
                    if (guild.roles.cache.has(GUARANTEED_MM)) {
                      await txtChannel.permissionOverwrites.edit(GUARANTEED_MM, { SendMessages: true, ViewChannel: true, ReadMessageHistory: true }).catch(() => null);
                    }
                  } else {
                    newName = `وسيط-مضمون-${ticketNumStr}`;
                    // Guaranteed write. New & Medium are view-only
                    if (guild.roles.cache.has(NEW_MM)) {
                      await txtChannel.permissionOverwrites.edit(NEW_MM, { SendMessages: false, ViewChannel: true, ReadMessageHistory: true }).catch(() => null);
                    }
                    if (guild.roles.cache.has(MEDIUM_MM)) {
                      await txtChannel.permissionOverwrites.edit(MEDIUM_MM, { SendMessages: false, ViewChannel: true, ReadMessageHistory: true }).catch(() => null);
                    }
                    if (guild.roles.cache.has(GUARANTEED_MM)) {
                      await txtChannel.permissionOverwrites.edit(GUARANTEED_MM, { SendMessages: true, ViewChannel: true, ReadMessageHistory: true }).catch(() => null);
                    }
                  }
                }

                // 3. Rename channel
                if (message.channel.type === ChannelType.GuildText) {
                  await message.channel.setName(newName).catch(() => null);
                }

                // Clean the raw ACTION string from the AI text for the user display
                aiResponseText = aiResponseText.replace(actionRegex, '').trim();

                // Append an elegant confirmation message in Arabic
                aiResponseText += `\n\n⚙️ **[نظام المساعد الآلي]:** تم تعديل قيمة التريد في النظام إلى **${newAmount}$**، وتغيير صلاحيات الرتب واسم القناة تلقائياً لتناسب الفئة الصحيحة!`;
              }
            } catch (jsonErr) {
              logger.error('Failed to parse dynamic AI action json:', jsonErr);
            }
          }

          // Send response back
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
