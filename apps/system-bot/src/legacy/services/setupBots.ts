// ══════════════════════════════════════════════════════════════
//  /setup-bots — bots showcase panel (guild 1395842846107631746 ONLY)
//  Posts an image (no embed) + a dropdown; selecting a bot shows its
//  details + prices (website USD prices, SAR via the fixed 3.75 peg).
// ══════════════════════════════════════════════════════════════

import {
  ActionRowBuilder,
  AttachmentBuilder,
  ChannelType,
  Interaction,
  Message,
  MessageFlags,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
} from "discord.js";
import { Logger } from "../utils/logger.js";

const COMMAND = "!setup-bots";
const GUILD_ID = "1395842846107631746";
const POST_CHANNEL_ID = "1523230388154138714"; // where the panel is posted
const REQUEST_CHANNEL_ID = "1396403268388655145"; // "to order, go to" room
const OPTION_EMOJI_ID = "1523242260626407494"; // same emoji on every option
const IMAGE_URL = "https://i.imgur.com/MbHLRVY.png";
const SELECT_ID = "setup_bots_select";

const USD_TO_SAR = 3.75; // Saudi Riyal is officially pegged to USD at 3.75.

interface BotEntry {
  value: string;
  nameEn: string;
  nameAr: string;
  desc: string;
  monthlyUsd: number;
  quarterlyUsd: number;
}

// Website products + prices (source of truth: apps/web site-content).
const BOTS: BotEntry[] = [
  { value: "ticket", nameEn: "Ticket Bot", nameAr: "بوت التذاكر", desc: "نظام تذاكر متكامل لإدارة طلبات العملاء (بنلات، ترانسكريبت، وسطاء، تصعيد).", monthlyUsd: 4.53, quarterlyUsd: 12.94 },
  { value: "temprooms", nameEn: "TempRooms", nameAr: "بوت الرومات", desc: "إنشاء غرف صوتية/كتابية مؤقتة تُحذف تلقائياً.", monthlyUsd: 3.0, quarterlyUsd: 9.0 },
  { value: "system", nameEn: "System Bot", nameAr: "بوت السستم", desc: "إدارة ومودريشن ولوقات وترحيب ومستويات واقتصاد.", monthlyUsd: 9.79, quarterlyUsd: 28.71 },
  { value: "broadcast", nameEn: "Broadcast Bot", nameAr: "بوت البرودكاست", desc: "أرسل رسالة خاصة لكل أعضاء سيرفرك أو رتبة محددة بضغطة.", monthlyUsd: 3.0, quarterlyUsd: 9.0 },
  { value: "humanguard", nameEn: "HumanGuard AI", nameAr: "حماية AI", desc: "بوت حماية ذكي يكتشف ويصدّ الرايدات والتهديدات تلقائياً.", monthlyUsd: 15.0, quarterlyUsd: 45.0 },
];

function sar(usd: number): string {
  return (usd * USD_TO_SAR).toFixed(2);
}

/** Handles the `!setup-bots` prefix command. Returns true if it consumed the message. */
export async function handleSetupBotsMessage(message: Message): Promise<boolean> {
  if (message.content.trim() !== COMMAND) return false;
  if (message.guildId !== GUILD_ID) return false; // command only exists for this server

  if (!message.member?.permissions.has(PermissionFlagsBits.Administrator)) {
    await message.reply("❌ هذا الأمر للأدمن فقط.").catch(() => null);
    return true;
  }

  const channel = await message.client.channels.fetch(POST_CHANNEL_ID).catch(() => null);
  if (!channel || channel.type !== ChannelType.GuildText) {
    await message.reply(`تعذّر العثور على الروم <#${POST_CHANNEL_ID}> أو ليس روم نصي.`).catch(() => null);
    return true;
  }

  const select = new StringSelectMenuBuilder()
    .setCustomId(SELECT_ID)
    .setPlaceholder("قم باختيار نوع البوت لعرض التفاصيل")
    .addOptions(
      BOTS.map((bot) => ({
        label: bot.nameEn,
        description: bot.nameAr,
        value: bot.value,
        emoji: { id: OPTION_EMOJI_ID },
      })),
    );

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);

  try {
    // Send the image as a file attachment so there is NO embed at all.
    const res = await fetch(IMAGE_URL);
    if (!res.ok) throw new Error(`image fetch ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    const image = new AttachmentBuilder(buffer, { name: "bots.png" });

    await channel.send({ files: [image], components: [row] });
    await message.reply(`تم نشر لوحة البوتات في <#${POST_CHANNEL_ID}> ✅`).catch(() => null);
  } catch (err) {
    Logger.error(`Failed to post setup-bots panel: ${err}`);
    await message.reply("تعذّر نشر اللوحة (فشل تحميل الصورة أو صلاحيات الإرسال).").catch(() => null);
  }
  return true;
}

/** Handles the bot-details dropdown. Returns true if it consumed the interaction. */
export async function handleSetupBotsInteraction(interaction: Interaction): Promise<boolean> {
  if (!interaction.isStringSelectMenu() || interaction.customId !== SELECT_ID) return false;

  const bot = BOTS.find((b) => b.value === interaction.values[0]);
  if (!bot) {
    await interaction.reply({ content: "هذا البوت غير معروف.", flags: MessageFlags.Ephemeral });
    return true;
  }

  const details =
    `**${bot.nameEn}**\n` +
    `${bot.desc}\n\n` +
    `**سعر الاشتراك لشهر:**\n` +
    `\`${sar(bot.monthlyUsd)} SR\` , \`$${bot.monthlyUsd.toFixed(2)}\`\n` +
    `**سعر الاشتراك لـ 3 شهور:**\n` +
    `\`${sar(bot.quarterlyUsd)} SR\` , \`$${bot.quarterlyUsd.toFixed(2)}\`\n\n` +
    `لطلب البوت التوجه الى <#${REQUEST_CHANNEL_ID}>`;

  await interaction.reply({ content: details, flags: MessageFlags.Ephemeral });
  return true;
}
