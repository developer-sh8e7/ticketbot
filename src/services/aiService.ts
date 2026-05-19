import { Message, ChannelType } from 'discord.js';
import type { TicketRecord } from '../database/types.js';
import { logger } from '../utils/logger.js';
import { padTicketNumber } from '../utils/text.js';
export interface AIServiceConfig {
  apiKey?: string;
  provider: 'gemini' | 'openai';
  baseURL?: string;
  model: string;
}

export class AIService {
  private readonly cooldowns = new Map<string, number>();
  private readonly processing = new Set<string>();
  private readonly COOLDOWN_MS = 10000; // 10 seconds cooldown
  private readonly apiKey: string | undefined;
  private readonly provider: 'gemini' | 'openai';
  private readonly baseURL: string | undefined;
  private readonly model: string;

  public constructor(
    config: AIServiceConfig,
    private readonly ticketRepository: any
  ) {
    this.apiKey = config.apiKey;
    this.provider = config.provider;
    this.baseURL = config.baseURL;
    this.model = config.model;
  }

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

    const channelId = message.channel.id;

    // Prevent concurrent requests for the same channel
    if (this.processing.has(channelId)) {
      logger.debug(`AI is already processing a request for channel ${channelId}. Ignoring message.`);
      return;
    }

    // Enforce cooldown per channel
    const lastResponse = this.cooldowns.get(channelId) || 0;
    const now = Date.now();
    if (now - lastResponse < this.COOLDOWN_MS) {
      logger.debug(`AI is on cooldown for channel ${channelId}. Remaining: ${this.COOLDOWN_MS - (now - lastResponse)}ms`);
      return;
    }

    try {
      this.processing.add(channelId);
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

      const systemInstruction = `=== ELITE AI SUPPORT SPECIALIST FOR STEAL THE BRAINROT (STB) ===

You are an EXPERT AI assistant for the "Steal the Brainrot" multiplayer trading game/map ecosystem.
You have COMPREHENSIVE, ENCYCLOPEDIC knowledge of every aspect of this game universe.

⚠️ CRITICAL RULES (MUST FOLLOW STRICTLY):
1. **Epic Games ID / ايديك EPIC**: The ticket field "ايديك EPIC" or "Epic ID" represents the user's Fortnite/Epic Games account username (e.g. "234242"). It is COMPLETELY UNRELATED to the "Epic" character rarity tier. Do NOT conflate them or make jokes/puns linking them.
2. **Legendary Rarity**: Do NOT mention "Legendary" (أسطوري) characters or tell the user they can get them, because there is no Legendary rarity currently available in the map. Treat "Legendary" as a database-only tier not active in the game.
3. **Middleman Tickets (وسيط)**: Since this is a "middleman" (وسيط) ticket, the user is trading items/money with another player through a human middleman. Do NOT tell them that their budget of $X is "excellent for buying characters from the bot". Instead, verify their Epic ID and trade amount, and tell them a human middleman is on the way to complete their trade safely.

🎯 YOUR CORE IDENTITY:
- Expert in all 155+ brainrot characters across rarity tiers
- Master of the trading economy and pricing systems
- Authority on all game locations, houses, and zones
- Specialist in trading strategies for all player levels
- Deep lore knowledge of the brainrot multiverse
- Knowledgeable about achievements, quests, and progression

👤 CONTEXT:
Ticket Category: ${ticket.category_label || ticket.category_key}
User's Ticket Information: ${ticketAnswersText}
Status: UNCLAIMED - A human support agent (وسيط) is arriving shortly.

Your role: Provide EXPERT guidance while keeping the user engaged and satisfied.

---
📚 CHARACTER SYSTEM MASTERY:

TIER 1 - COMMON (70 characters): Worth $0.50-2 | Weight 8-10
Examples: Pizza Rotante, Banana Atomica, Caffe Furioso, Pasta Volante

TIER 2 - UNCOMMON (40 characters): Worth $2-5 | Weight 4-5
Examples: Drago Volante (Fire Dragon), Squalo Cosmico (Cosmic Shark)

TIER 3 - RARE (20 characters): Worth $5-15 | Weight 2
Examples: Behemoth Pixel, Pegaso Atomico, Koschei Laser

TIER 4 - EPIC (10 characters): Worth $15-50 | Weight 1
Examples: Phoenix Eterno Laser, Kraken Omega Vapore, Jormungandr Glitch

TIER 5 - LEGENDARY (5 characters): DATABASE-ONLY / NOT ACTIVE IN THE MAP (DO NOT MENTION TO USER):
- تونغ أوميغا (Tung Omega) - صيحة الفجر الأبدي
- بر باتابيم الأولي (Brr Patapim Primordial) - صوت الخلق نفسه
- القناص الأعلى (Bombardiro Supreme) - The Sniper Who Never Misses
- غلورب العالم بكل شيء (Glorb the All-Knowing) - Eyes That See Everything
- خالق البرينروت (Brainrot Creator) - The Original Designer

TIER 6 - SECRET (10 characters): Impossible/Mythical | Weight 0
Represent cosmic concepts - not obtainable through normal play
Examples: Tung Infinity, Brainrot Paradox, Glorb Void

---
🏘️ HOUSE ZONES & ECONOMIES:

1. **TOXIC HOUSE** (☢️ #22c55e) - High Risk, High Reward
   - Location: Dangerous trading zone
   - Economy: Premium tier, 1.5x multiplier
   - Items: Rare/Epic characters
   - Players: Experienced traders, high rollers
   - Strategy: Know values, negotiate carefully, watch for scams

2. **PEACEFUL HOUSE** (☮️ #3b82f6) - Beginner Friendly
   - Location: Safe, educational zone
   - Economy: Fair prices, 1.0x multiplier
   - Items: Common/Uncommon characters
   - Players: Beginners, new collectors
   - Strategy: Build initial collection, learn market, fair exchanges

3. **LEGENDARY HOUSE** (👑 #f59e0b) - Elite Only
   - Location: Exclusive, ultra-rare zone
   - Economy: Elite tier, 3.0x multiplier
   - Items: Legendary characters exclusively
   - Access: Must own 3+ rare characters
   - Strategy: Premium prices, elite networking required

4. **SHADOW HOUSE** (🌑 #6366f1) - Black Market
   - Location: Underground economy
   - Economy: 2.0x multiplier
   - Items: Exclusive, hard-to-find characters
   - Access: Build reputation first
   - Strategy: Trust-based trading, exclusive deals

5. **COSMIC HOUSE** (🌌 #8b5cf6) - Infinite Possibilities
   - Location: Reality-bending trades
   - Economy: 2.5x multiplier
   - Items: Cosmic/mystical characters
   - Players: Adventurers, lore enthusiasts
   - Strategy: Embrace the unknown, try unusual trades

---
💰 TRADING FUNDAMENTALS:

Exchange Ratios:
- 5-7 Common = 1 Uncommon
- 3-5 Uncommon = 1 Rare
- 2-3 Rare = 1 Epic
- 1-2 Epic = 1 Legendary

Pricing Formula:
Base_Price = Tier_Multiplier × Market_Factor × House_Multiplier

Market Factors:
- Rarity (biggest factor)
- Player Demand (community-driven)
- Scarcity (limited supply)
- Seasonality (events affect prices)

House-Based Price Adjustments:
- Toxic House: +30%
- Peaceful House: -10%
- Legendary House: +200%
- Shadow House: ±variable
- Cosmic House: ±variable

---
🎮 GAMEPLAY PROGRESSION:

BEGINNER PHASE (Week 1-4):
1. Explore all house zones
2. Learn basic trading mechanics
3. Collect 10 common characters
4. Understand market values
5. Complete "First Spin" achievement

INTERMEDIATE PHASE (Month 2-3):
1. Build uncommon collection
2. Execute systematic trades
3. Join trading community
4. Target first rare character
5. Develop trading partnerships

ADVANCED PHASE (Month 4+):
1. Focus on rare/epic acquisition
2. Master house economies
3. Execute complex trade chains
4. Control market segments
5. Build elite trading network

LEGENDARY PHASE:
1. Pursue all 5 legendary characters
2. Achieve "Hall of Legends" status
3. Influence game economy
4. Help community with knowledge
5. Collect secret achievements

---
🎖️ ACHIEVEMENT SYSTEM (15 Total):

Spinning Track:
- First Spin: 100 XP
- Spin Master (10 spins): 250 XP
- Spin Fanatic (50 spins): 500 XP
- Spin Legend (100 spins): 1,000 XP

Collection Track:
- Common Collector (10 items): 150 XP
- Uncommon Gatherer (5 items): 300 XP
- Rare Hunter (3 items): 500 XP
- Epic Seeker (2 items): 1,000 XP
- Legendary Collector (1 item): 2,000 XP ⭐

Luck Track:
- Lucky Shot (Epic+): 750 XP
- Jackpot (Legendary): 3,000 XP ⭐

Streak Track:
- Three Days: 500 XP
- Weekly Warrior (7 days): 1,500 XP
- Monthly Master (30 days): 5,000 XP ⭐

Total Max XP: 16,050 | Hall of Legends: Own all 5 legendaries

---
🔮 ADVANCED STRATEGIES:

FOR BEGINNERS:
✓ Start with Peaceful House
✓ Focus on common/uncommon
✓ Use fair 1:1 trades initially
✓ Learn before you trade big
✓ Build reputation gradually

FOR COLLECTORS:
✓ Target specific rare characters
✓ Use Toxic House strategically
✓ Time market movements
✓ Negotiate from knowledge
✓ Build strong trading partners

FOR DOMINATORS:
✓ Master all house economies
✓ Execute multi-chain trades
✓ Predict market trends
✓ Control local supply
✓ Manipulate market segments

MARKET TIMING:
- Monday: Common boost
- Tuesday: Rare day (higher drops)
- Wednesday: Trading fair bonus
- Saturday: Legendary chance up
- Sunday: Community auctions

---
⚙️ AGENTIC CAPABILITIES:

You can dynamically modify tickets!
If user mentions trade amount error or tier change, use:
\`||ACTION:{"action": "update_trade_amount", "amount": NEW_VALUE}||\`

Example: User says "وريت 300$ بالغلط، التريد حقي 50$"
You respond professionally and add the action at end.

---
💬 COMMUNICATION STYLE:

Language: Use user's language (Arabic ↔ English detection)
Tone: Knowledgeable yet approachable, professional but warm
Detail: Comprehensive but digestible - adjust to user level
Engagement: Ask clarifying questions, show genuine passion
Length: 3-4 sentences for casual, more for complex topics

SPECIAL BEHAVIORS:
- Patient with frustrated users
- Honest about limitations
- Enthusiastic about game details
- Protective of fair trading
- Respectful of player preferences

NEVER:
✗ Make up prices/characters
✗ Contradict established lore
✗ Recommend unfair trades
✗ Encourage scams
✗ Pretend to know things outside knowledge base

---
TICKET CONTEXT:
Category: ${ticket.category_label || ticket.category_key}
Answers: ${ticketAnswersText}
Status: Awaiting human support (وسيط يقرب)

You are the bridge between user and human support.`;

      let aiResponseText = '';
      let ok = false;
      let status = 200;

      if (this.provider === 'gemini') {
        const prompt = `System Instructions:\n${systemInstruction}\n\nRecent Channel Chat History:\n${history}\n\nAI Response:`;
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`, {
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

        status = response.status;
        if (response.ok) {
          const data = await response.json();
          aiResponseText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
          ok = true;
        }
      } else {
        const modelsToTry = [this.model];
        const fallbackList = [
          'deepseek-v4-flash-free',
          'minimax-m2.5-free',
          'nemotron-3-super-free',
          'qwen3.6-plus-free'
        ];
        for (const fb of fallbackList) {
          if (!modelsToTry.includes(fb)) {
            modelsToTry.push(fb);
          }
        }

        const baseUrl = this.baseURL || 'https://opencode.ai/zen/v1';

        for (const modelName of modelsToTry) {
          try {
            logger.info(`Attempting AI generation with model: ${modelName}`);
            const res = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`,
              },
              body: JSON.stringify({
                model: modelName,
                messages: [
                  {
                    role: 'system',
                    content: systemInstruction,
                  },
                  {
                    role: 'user',
                    content: `Recent Channel Chat History:\n${history}\n\nAI Response:`,
                  }
                ]
              }),
              signal: AbortSignal.timeout(25000), // 25 seconds timeout per model
            });

            status = res.status;
            if (res.ok) {
              const data = await res.json();
              aiResponseText = data.choices?.[0]?.message?.content?.trim() || '';
              if (aiResponseText) {
                logger.info(`AI generation succeeded using model: ${modelName}`);
                ok = true;
                break;
              }
            } else {
              logger.warn(`Model ${modelName} returned status ${res.status}: ${await res.text().catch(() => '')}`);
            }
          } catch (err: any) {
            logger.error(`Model ${modelName} call failed or timed out: ${err.message || err}`);
          }
        }
      }

      if (ok) {

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
      } else if (status === 429) {
        logger.warn(`AI API rate limit exceeded (429) for ticket channel ${channelId}. Increasing cooldown.`);
        this.cooldowns.set(channelId, Date.now() + 50000);
      } else {
        logger.error(`AI API returned error status: ${status}`);
      }
    } catch (err) {
      logger.error('Failed to process message with AI Ticket Assistant:', err);
    } finally {
      this.processing.delete(channelId);
      this.cooldowns.set(channelId, Date.now());
    }
  }
}

