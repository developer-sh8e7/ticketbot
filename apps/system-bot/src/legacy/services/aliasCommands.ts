// ══════════════════════════════════════════════════════════════
//  اختصارات الأوامر — كلمة عربية مخصّصة يحددها العميل من الموقع
//  (مثال: "باند" => /ban) تُنفَّذ عبر رسالة عادية بدل سلاش.
//
//  يبني "تفاعل وهمي" يحاكي ChatInputCommandInteraction فوق الرسالة
//  العادية، عشان نعيد استخدام نفس دالة execute() لكل أمر بدون أي
//  تكرار لمنطق الصلاحيات أو التنفيذ.
// ══════════════════════════════════════════════════════════════

import { Message, Collection, ChatInputCommandInteraction } from "discord.js";
import { Command } from "../types.js";
import { Logger } from "../utils/logger.js";
import { supabase } from "../db/supabase.js";
import { getGuildConfig } from "../db/guilds.js";
import { stripMessageCommandPrefix } from "../utils/prefix.js";

/** فقط أوامر المودريشن البسيطة قابلة للاختصار حالياً (تطابق قائمة الداشبورد). */
export const ALIASABLE_COMMANDS = new Set([
  "ban", "softban", "kick", "timeout", "mute", "unmute", "warn", "warnings", "clearwarns", "clear", "unban",
  "slowmode", "lock", "unlock", "nuke", "role", "nick", "hide", "show",
]);

// Discord ApplicationCommandOptionType (subset نحتاجه فقط)
const OPT_STRING = 3;
const OPT_INTEGER = 4;
const OPT_USER = 6;
const OPT_CHANNEL = 7;
const OPT_ROLE = 8;

type OptionDef = { name: string; type: number };

// ── Cache بسيط (60 ثانية) عشان ما نضرب القاعدة على كل رسالة ──
const ALIAS_TTL_MS = 60_000;
const aliasCache = new Map<string, { map: Map<string, string>; expiresAt: number }>();

async function getAliasMap(guildId: string): Promise<Map<string, string>> {
  const cached = aliasCache.get(guildId);
  if (cached && cached.expiresAt > Date.now()) return cached.map;

  const map = new Map<string, string>();
  try {
    const { data } = await supabase
      .from("guild_command_aliases")
      .select("alias,command_name")
      .eq("guild_id", guildId);
    for (const row of data ?? []) map.set(row.alias, row.command_name);
  } catch (err) {
    Logger.error(`Failed to load command aliases for guild ${guildId}: ${err}`);
  }

  aliasCache.set(guildId, { map, expiresAt: Date.now() + ALIAS_TTL_MS });
  return map;
}

/** يبني resolver يحاكي interaction.options فوق نص الرسالة بعد كلمة الاختصار. */
function buildFakeOptions(optionDefs: OptionDef[], remainder: string, message: Message) {
  const userPool = [...message.mentions.users.values()];
  const channelPool = [...message.mentions.channels.values()];
  const rolePool = [...message.mentions.roles.values()];

  const plainText = remainder
    .replace(/<@!?\d+>|<#\d+>|<@&\d+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const plainTokens = plainText.length ? plainText.split(" ") : [];
  let tokenIdx = 0;

  const values = new Map<string, unknown>();

  optionDefs.forEach((opt, i) => {
    const isLast = i === optionDefs.length - 1;
    if (opt.type === OPT_USER) {
      const u = userPool.shift();
      if (u) values.set(opt.name, u);
    } else if (opt.type === OPT_CHANNEL) {
      const c = channelPool.shift();
      if (c) values.set(opt.name, c);
    } else if (opt.type === OPT_ROLE) {
      const r = rolePool.shift();
      if (r) values.set(opt.name, r);
    } else if (opt.type === OPT_STRING) {
      if (isLast) {
        const rest = plainTokens.slice(tokenIdx).join(" ");
        if (rest) values.set(opt.name, rest);
        tokenIdx = plainTokens.length;
      } else if (plainTokens[tokenIdx] !== undefined) {
        values.set(opt.name, plainTokens[tokenIdx]);
        tokenIdx++;
      }
    } else if (opt.type === OPT_INTEGER) {
      const t = plainTokens[tokenIdx];
      if (t !== undefined) {
        const n = parseInt(t, 10);
        if (!Number.isNaN(n)) values.set(opt.name, n);
        tokenIdx++;
      }
    }
  });

  function need(name: string, required?: boolean) {
    const v = values.get(name);
    if (v === undefined && required) throw new Error(`MISSING_OPTION:${name}`);
    return v ?? null;
  }

  return {
    getUser: (name: string, required?: boolean) => need(name, required),
    getString: (name: string, required?: boolean) => need(name, required),
    getInteger: (name: string, required?: boolean) => need(name, required),
    getChannel: (name: string, required?: boolean) => need(name, required),
    getRole: (name: string, required?: boolean) => need(name, required),
  };
}

/**
 * يحاول تنفيذ الرسالة كاختصار أمر. يرجّع true إذا كانت اختصاراً (تم التعامل
 * معها بغض النظر عن نجاح التنفيذ)، أو false إذا ما كانت اختصاراً إطلاقاً.
 */
export async function tryDispatchAlias(message: Message, commands: Collection<string, Command>): Promise<boolean> {
  if (!message.guild || message.author.bot) return false;

  const rawContent = message.content.trim();
  if (!rawContent) return false;

  const guildConfig = await getGuildConfig(message.guild.id);
  const content = stripMessageCommandPrefix(rawContent, [guildConfig.settings.prefix, "<"]);
  if (!content) return false;

  const firstSpace = content.indexOf(" ");
  const firstWord = firstSpace === -1 ? content : content.slice(0, firstSpace);
  if (!firstWord) return false;

  const aliasMap = await getAliasMap(message.guild.id);
  const commandName = aliasMap.get(firstWord);
  if (!commandName || !ALIASABLE_COMMANDS.has(commandName)) return false;

  const command = commands.get(commandName);
  if (!command) return false;

  const remainder = firstSpace === -1 ? "" : content.slice(firstSpace + 1);
  const optionDefs = ((command.data as { toJSON?: () => { options?: OptionDef[] } }).toJSON?.().options ?? []) as OptionDef[];

  try {
    const options = buildFakeOptions(optionDefs, remainder, message);
    const fakeInteraction = {
      member: message.member,
      guild: message.guild,
      guildId: message.guildId,
      user: message.author,
      channel: message.channel,
      options,
      reply: (payload: { embeds?: unknown[]; content?: string }) =>
        message.reply({ embeds: payload.embeds as never, content: payload.content }).catch(() => null),
    };
    await command.execute(fakeInteraction as unknown as ChatInputCommandInteraction);
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("MISSING_OPTION:")) {
      await message.reply("استخدام ناقص — تأكد إنك حددت الشخص/الروم المطلوب بمنشن صحيح.").catch(() => {});
    } else {
      Logger.error(`Alias dispatch failed ("${firstWord}" → ${commandName}): ${err}`);
      await message.reply("صار خطأ أثناء تنفيذ الأمر.").catch(() => {});
    }
  }

  return true;
}
