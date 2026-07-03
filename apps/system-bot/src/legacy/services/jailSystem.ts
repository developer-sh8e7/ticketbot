import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChannelType,
  Client,
  EmbedBuilder,
  Guild,
  GuildMember,
  Interaction,
  Message,
  ModalBuilder,
  ModalSubmitInteraction,
  PermissionFlagsBits,
  TextChannel,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { supabase } from "../db/supabase.js";
import { Config } from "../config.js";
import { Logger } from "../utils/logger.js";
import { Colors, errorEmbed, infoEmbed, successEmbed } from "../utils/embed.js";
import { isOwner } from "../utils/permissions.js";

const CONTROL_CHANNEL_NAME = "سجن-تحكم";
const JAIL_ROLE_NAME = "مسجون";
const CONFIG_TTL_MS = 30_000;
const SCHEDULER_MS = 30_000;
const MAX_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
const MIN_DURATION_MS = 60 * 60 * 1000;
const MAX_DELEGATES = 50;
const SNOWFLAKE = /^\d{17,20}$/;

const jailConfigCache = new Map<string, { config: JailConfig; expiresAt: number }>();
const commandRate = new Map<string, number[]>();
const jailRoleDenySync = new Map<string, number>();
let schedulerStarted = false;

type JailConfig = {
  enabled: boolean;
  allowedRoleIds: string[];
  allowedUserIds: string[];
  controlChannelId?: string | null;
  jailRoleId?: string | null;
  updatedAt?: string;
};

type JailRecord = {
  id: string;
  guild_id: string;
  user_id: string;
  jailed_by_id: string;
  jail_role_id: string | null;
  original_role_ids: unknown;
  reason: string | null;
  started_at: string;
  expires_at: string;
};

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? Array.from(new Set(value.map((v) => String(v)).filter((v) => SNOWFLAKE.test(v)))).slice(0, 80) : [];
}

function defaultConfig(): JailConfig {
  return { enabled: false, allowedRoleIds: [], allowedUserIds: [] };
}

function getJailFromConfigData(configData: unknown): JailConfig {
  const raw = configData && typeof configData === "object" ? (configData as Record<string, unknown>).jail : null;
  if (!raw || typeof raw !== "object") return defaultConfig();
  const r = raw as Record<string, unknown>;
  return {
    enabled: r.enabled === true,
    allowedRoleIds: asStringArray(r.allowedRoleIds),
    allowedUserIds: asStringArray(r.allowedUserIds),
    controlChannelId: typeof r.controlChannelId === "string" ? r.controlChannelId : null,
    jailRoleId: typeof r.jailRoleId === "string" ? r.jailRoleId : null,
    updatedAt: typeof r.updatedAt === "string" ? r.updatedAt : undefined,
  };
}

async function getJailConfig(guildId: string, fresh = false): Promise<JailConfig> {
  const cached = jailConfigCache.get(guildId);
  if (!fresh && cached && cached.expiresAt > Date.now()) return cached.config;

  try {
    const { data, error } = await supabase
      .from("server_configs")
      .select("config_data")
      .eq("guild_id", guildId)
      .eq("product_type", "general")
      .maybeSingle();
    if (error) throw error;
    const config = getJailFromConfigData(data?.config_data);
    jailConfigCache.set(guildId, { config, expiresAt: Date.now() + CONFIG_TTL_MS });
    return config;
  } catch (err) {
    Logger.error(`Failed to load jail config for guild ${guildId}: ${err}`);
    return defaultConfig();
  }
}

async function patchJailConfig(guildId: string, patch: Partial<JailConfig>) {
  try {
    const { data } = await supabase
      .from("server_configs")
      .select("config_data")
      .eq("guild_id", guildId)
      .eq("product_type", "general")
      .maybeSingle();
    const configData = data?.config_data && typeof data.config_data === "object" ? (data.config_data as Record<string, unknown>) : {};
    const current = getJailFromConfigData(configData);
    const jail = { ...current, ...patch, updatedAt: new Date().toISOString() };
    const next = { ...configData, jail };
    const { error } = await supabase.from("server_configs").upsert(
      { guild_id: guildId, product_type: "general", config_data: next, updated_at: new Date().toISOString() },
      { onConflict: "guild_id,product_type" },
    );
    if (error) throw error;
    jailConfigCache.set(guildId, { config: jail, expiresAt: Date.now() + CONFIG_TTL_MS });
  } catch (err) {
    Logger.error(`Failed to update jail resource ids for guild ${guildId}: ${err}`);
  }
}

function memberMatchesDashboardAllow(member: GuildMember, config: JailConfig): boolean {
  if (config.allowedUserIds.includes(member.id)) return true;
  return config.allowedRoleIds.some((roleId) => roleId !== member.guild.id && member.roles.cache.has(roleId));
}

async function isDelegate(guildId: string, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("guild_jail_delegates")
    .select("id")
    .eq("guild_id", guildId)
    .eq("user_id", userId)
    .is("revoked_at", null)
    .maybeSingle();
  if (error) return false;
  return Boolean(data?.id);
}

async function isJailAuthorized(member: GuildMember, config: JailConfig): Promise<boolean> {
  if (!config.enabled) return false;
  if (member.id === member.guild.ownerId || isOwner(member.id)) return true;
  if (memberMatchesDashboardAllow(member, config)) return true;
  return isDelegate(member.guild.id, member.id);
}

async function activeDelegates(guildId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("guild_jail_delegates")
    .select("user_id")
    .eq("guild_id", guildId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .limit(MAX_DELEGATES);
  if (error) return [];
  return (data ?? []).map((r) => String(r.user_id)).filter((id) => SNOWFLAKE.test(id));
}

async function audit(guildId: string, action: string, actorId: string | null, targetUserId: string | null, reason: string | null, metadata: Record<string, unknown> = {}) {
  const { error } = await supabase.from("guild_jail_audit").insert({
    guild_id: guildId,
    action,
    actor_id: actorId,
    target_user_id: targetUserId,
    reason,
    metadata,
  });
  if (error) Logger.warn(`Failed to write jail audit ${action}: ${error.message}`);
}

async function ensureJailResources(guild: Guild, config: JailConfig): Promise<{ role: any | null; channel: TextChannel | null }> {
  if (!config.enabled) return { role: null, channel: null };
  const me = guild.members.me ?? (await guild.members.fetchMe().catch(() => null));
  if (!me) return { role: null, channel: null };

  let role = config.jailRoleId ? guild.roles.cache.get(config.jailRoleId) ?? null : null;
  let createdRole = false;
  if (!role) role = guild.roles.cache.find((r) => r.name === JAIL_ROLE_NAME) ?? null;
  if (!role) {
    if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) {
      Logger.warn(`Jail enabled in ${guild.id} but bot lacks ManageRoles`);
      return { role: null, channel: null };
    }
    role = await guild.roles.create({ name: JAIL_ROLE_NAME, permissions: [], reason: "Opus jail system setup" }).catch((err) => {
      Logger.error(`Failed to create jail role in ${guild.id}: ${err}`);
      return null;
    });
    createdRole = Boolean(role);
  }

  const channelFromId = config.controlChannelId ? guild.channels.cache.get(config.controlChannelId) : null;
  let channel = channelFromId?.type === ChannelType.GuildText ? (channelFromId as TextChannel) : null;
  if (!channel) channel = guild.channels.cache.find((c) => c.type === ChannelType.GuildText && c.name === CONTROL_CHANNEL_NAME) as TextChannel | undefined ?? null;

  const delegates = await activeDelegates(guild.id);
  const overwrites = [
    { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: me.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages] },
    ...config.allowedRoleIds.filter((id) => guild.roles.cache.has(id)).map((id) => ({ id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] })),
    ...config.allowedUserIds.map((id) => ({ id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] })),
    ...delegates.map((id) => ({ id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] })),
  ];

  if (!channel) {
    if (!me.permissions.has(PermissionFlagsBits.ManageChannels)) {
      Logger.warn(`Jail enabled in ${guild.id} but bot lacks ManageChannels`);
    } else {
      channel = await guild.channels.create({
        name: CONTROL_CHANNEL_NAME,
        type: ChannelType.GuildText,
        permissionOverwrites: overwrites,
        reason: "Opus jail system control channel",
      }).catch((err) => {
        Logger.error(`Failed to create jail channel in ${guild.id}: ${err}`);
        return null;
      });
    }
  } else if (me.permissions.has(PermissionFlagsBits.ManageChannels)) {
    await channel.permissionOverwrites.set(overwrites, "Opus jail system access sync").catch((err) => Logger.warn(`Failed to sync jail channel overwrites: ${err}`));
  }

  const lastDenySync = jailRoleDenySync.get(guild.id) ?? 0;
  if (role && me.permissions.has(PermissionFlagsBits.ManageChannels) && (createdRole || Date.now() - lastDenySync > 10 * 60_000)) {
    await applyJailRoleDenies(guild, role.id);
    jailRoleDenySync.set(guild.id, Date.now());
  }

  if (role?.id !== config.jailRoleId || channel?.id !== config.controlChannelId) {
    await patchJailConfig(guild.id, { jailRoleId: role?.id ?? config.jailRoleId, controlChannelId: channel?.id ?? config.controlChannelId });
  }

  return { role, channel };
}

async function applyJailRoleDenies(guild: Guild, jailRoleId: string) {
  const deny = {
    ViewChannel: false,
    SendMessages: false,
    SendMessagesInThreads: false,
    CreatePublicThreads: false,
    CreatePrivateThreads: false,
    AddReactions: false,
    Connect: false,
    Speak: false,
    UseApplicationCommands: false,
  };
  const jobs = guild.channels.cache.map((channel) => {
    if (!("permissionOverwrites" in channel)) return Promise.resolve(null);
    return channel.permissionOverwrites.edit(jailRoleId, deny, { reason: "Opus jail role lockdown" }).catch(() => null);
  });
  await Promise.all(jobs);
}

function extractSnowflake(input: string): string | null {
  return input.match(/\d{17,20}/)?.[0] ?? null;
}

function parseDuration(input: string): number | null {
  const raw = input.trim().toLowerCase();
  const match = raw.match(/^(\d{1,3})(?:\s*(h|hr|hour|hours|س|ساعة|ساعات|d|day|days|ي|يوم|ايام|أيام))?$/i);
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = match[2] ?? "h";
  const days = /^(d|day|days|ي|يوم|ايام|أيام)$/i.test(unit);
  const ms = amount * (days ? 24 : 1) * 60 * 60 * 1000;
  return ms >= MIN_DURATION_MS && ms <= MAX_DURATION_MS ? ms : null;
}

function durationText(ms: number): string {
  const hours = Math.round(ms / 3_600_000);
  if (hours % 24 === 0) return `${hours / 24} يوم`;
  return `${hours} ساعة`;
}

function isRateLimited(guildId: string, userId: string): boolean {
  const key = `${guildId}:${userId}`;
  const now = Date.now();
  const recent = (commandRate.get(key) ?? []).filter((t) => now - t < 60_000);
  if (recent.length >= 5) {
    commandRate.set(key, recent);
    return true;
  }
  recent.push(now);
  commandRate.set(key, recent);
  return false;
}

async function activeJail(guildId: string, userId: string): Promise<JailRecord | null> {
  const { data, error } = await supabase
    .from("guild_jail_prisoners")
    .select("*")
    .eq("guild_id", guildId)
    .eq("user_id", userId)
    .is("released_at", null)
    .maybeSingle();
  if (error) return null;
  return (data as JailRecord | null) ?? null;
}

async function canActOnTarget(actor: GuildMember, target: GuildMember, config: JailConfig): Promise<string | null> {
  const guild = actor.guild;
  const botMember = guild.members.me ?? (await guild.members.fetchMe().catch(() => null));
  if (!botMember) return "تعذّر قراءة رتبة البوت.";
  if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) return "البوت يحتاج صلاحية Manage Roles لإدارة السجن.";
  if (target.id === guild.ownerId) return "لا يمكن سجن مالك السيرفر.";
  if (target.id === botMember.id) return "لا يمكن سجن البوت نفسه.";
  if (target.id === actor.id) return "لا يمكنك سجن نفسك.";
  if (!isOwner(actor.id) && actor.id !== guild.ownerId && actor.roles.highest.position <= target.roles.highest.position) return "رتبة العضو أعلى أو مساوية لرتبتك.";
  if (botMember.roles.highest.position <= target.roles.highest.position) return "رتبة العضو أعلى أو مساوية لرتبة البوت. ارفع رتبة البوت فوقه أولاً.";
  if (await isJailAuthorized(target, config) && actor.id !== guild.ownerId && !isOwner(actor.id)) return "لا يمكن سجن شخص مخوّل بإدارة نظام السجن إلا بواسطة مالك السيرفر.";

  const unmanageable = target.roles.cache.filter((role) => role.id !== guild.id && role.id !== config.jailRoleId && (role.managed || role.position >= botMember.roles.highest.position));
  if (unmanageable.size > 0) return `لا يمكن ضمان السجن الكامل لأن لدى العضو رتب لا يستطيع البوت سحبها: ${unmanageable.map((r) => r.name).join(", ")}`;
  return null;
}

async function jailMember(guild: Guild, actor: GuildMember, targetId: string, durationMs: number, reason: string): Promise<string> {
  const config = await getJailConfig(guild.id, true);
  const { role } = await ensureJailResources(guild, config);
  if (!role) throw new Error("تعذّر تجهيز رتبة مسجون. تأكد من صلاحية Manage Roles للبوت.");

  const target = await guild.members.fetch(targetId).catch(() => null);
  if (!target) throw new Error("ما لقيت العضو داخل السيرفر.");
  const denyReason = await canActOnTarget(actor, target, { ...config, jailRoleId: role.id });
  if (denyReason) throw new Error(denyReason);
  if (await activeJail(guild.id, target.id)) throw new Error("هذا العضو مسجون حالياً بالفعل.");
  if (!reason || reason.trim().length < 3) throw new Error("اكتب سبب واضح للسجن (3 أحرف على الأقل). هذا يمنع إساءة الاستخدام.");

  const originalRoleIds = target.roles.cache.filter((r) => r.id !== guild.id && r.id !== role.id).map((r) => r.id);
  const expiresAt = new Date(Date.now() + durationMs).toISOString();
  const { data, error } = await supabase.from("guild_jail_prisoners").insert({
    guild_id: guild.id,
    user_id: target.id,
    jailed_by_id: actor.id,
    jail_role_id: role.id,
    original_role_ids: originalRoleIds,
    reason,
    expires_at: expiresAt,
  }).select("id").single();
  if (error) throw new Error(error.message.includes("duplicate") ? "هذا العضو مسجون حالياً بالفعل." : "تعذّر حفظ السجن في قاعدة البيانات.");

  try {
    await target.roles.set([role.id], `Jailed by ${actor.user.tag}: ${reason}`);
  } catch (err) {
    await supabase.from("guild_jail_prisoners").update({ released_at: new Date().toISOString(), release_kind: "apply_failed", release_reason: "Discord role update failed" }).eq("id", data.id);
    throw new Error("فشل سحب رتب العضو من Discord. تأكد من ترتيب رتبة البوت.");
  }

  await audit(guild.id, "jail", actor.id, target.id, reason, { durationMs, expiresAt, originalRoleCount: originalRoleIds.length });
  await target.send({ embeds: [infoEmbed("تم سجنك", `تم تطبيق رتبة **${JAIL_ROLE_NAME}** في سيرفر **${guild.name}** لمدة **${durationText(durationMs)}**.\n**السبب:** ${reason}`)] }).catch(() => null);
  return `${target} تم سجنه لمدة **${durationText(durationMs)}**. تنتهي: <t:${Math.floor(new Date(expiresAt).getTime() / 1000)}:R>`;
}

async function releaseJail(guild: Guild, targetId: string, actorId: string | null, reason: string, kind: string): Promise<{ text: string; released: boolean }> {
  const record = await activeJail(guild.id, targetId);
  if (!record) return { text: "هذا العضو غير مسجون حالياً.", released: false };
  const target = await guild.members.fetch(targetId).catch(() => null);
  const botMember = guild.members.me ?? (await guild.members.fetchMe().catch(() => null));
  const originalRoleIds = asStringArray(record.original_role_ids);
  const skippedRoleIds: string[] = [];

  if (target && botMember) {
    const restorable = originalRoleIds.filter((roleId) => {
      const role = guild.roles.cache.get(roleId);
      if (!role || role.managed || role.position >= botMember.roles.highest.position) {
        skippedRoleIds.push(roleId);
        return false;
      }
      return true;
    });
    await target.roles.set(restorable, `Jail release: ${reason}`).catch((err) => {
      Logger.warn(`Failed to restore jail roles for ${targetId}: ${err}`);
      throw new Error("فشل إرجاع الرتب. تأكد من ترتيب رتبة البوت.");
    });
    await target.send({ embeds: [successEmbed("تم إطلاق سراحك", `تم فك السجن في سيرفر **${guild.name}**.\n**السبب:** ${reason}`)] }).catch(() => null);
  }

  const { error } = await supabase.from("guild_jail_prisoners").update({
    released_at: new Date().toISOString(),
    released_by_id: actorId,
    release_kind: kind,
    release_reason: reason,
    skipped_role_ids: skippedRoleIds,
  }).eq("id", record.id);
  if (error) throw new Error("تمت محاولة الإطلاق لكن فشل تحديث قاعدة البيانات.");

  await audit(guild.id, kind === "expired" ? "auto_release" : "release", actorId, targetId, reason, { skippedRoleIds, memberPresent: Boolean(target) });
  return { text: `تم إطلاق سراح <@${targetId}>.${skippedRoleIds.length ? `\nتنبيه: بعض الرتب لم ترجع لأنها محذوفة/غير قابلة للإدارة: ${skippedRoleIds.join(", ")}` : ""}`, released: true };
}

async function grantDelegate(guild: Guild, actor: GuildMember, targetId: string): Promise<string> {
  if (targetId === actor.id) throw new Error("لا تحتاج تفويض نفسك.");
  const target = await guild.members.fetch(targetId).catch(() => null);
  if (!target) throw new Error("ما لقيت العضو داخل السيرفر.");
  const { count } = await supabase.from("guild_jail_delegates").select("id", { count: "exact", head: true }).eq("guild_id", guild.id).is("revoked_at", null);
  if ((count ?? 0) >= MAX_DELEGATES) throw new Error(`وصلت للحد الأعلى للتفويضات النشطة (${MAX_DELEGATES}). اسحب تفويض قديم أولاً.`);
  const existing = await isDelegate(guild.id, targetId);
  if (existing) return "هذا العضو مفوض مسبقاً.";
  const { error } = await supabase.from("guild_jail_delegates").insert({ guild_id: guild.id, user_id: targetId, granted_by_id: actor.id });
  if (error) throw new Error("تعذّر حفظ التفويض.");
  await audit(guild.id, "delegate_grant", actor.id, targetId, null);
  await patchJailConfig(guild.id, {});
  await ensureJailResources(guild, await getJailConfig(guild.id, true));
  return `تم تفويض ${target} لاستخدام نظام السجن.`;
}

async function revokeDelegate(guild: Guild, actor: GuildMember, targetId: string): Promise<string> {
  const { error, count } = await supabase
    .from("guild_jail_delegates")
    .update({ revoked_at: new Date().toISOString(), revoked_by_id: actor.id }, { count: "exact" })
    .eq("guild_id", guild.id)
    .eq("user_id", targetId)
    .is("revoked_at", null);
  if (error) throw new Error("تعذّر سحب التفويض.");
  if (count === 0) return "هذا العضو ليس لديه تفويض نشط.";
  await audit(guild.id, "delegate_revoke", actor.id, targetId, null);
  await ensureJailResources(guild, await getJailConfig(guild.id, true));
  return `تم سحب تفويض <@${targetId}>.`;
}

async function sendPanel(message: Message) {
  const embed = new EmbedBuilder()
    .setTitle("نظام السجن")
    .setDescription([
      "استخدم الأزرار لإدارة السجن بدون بريفكس.",
      "**المدة:** من ساعة واحدة إلى أسبوع كحد أقصى.",
      "كل عملية تُحفظ في سجل التدقيق وتظهر للمالك في الداشبورد.",
    ].join("\n"))
    .setColor(Colors.info)
    .setFooter({ text: Config.embed.footer })
    .setTimestamp();
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("jail:open:jail").setLabel("سجن عضو").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("jail:open:release").setLabel("إطلاق سراح").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("jail:open:delegate").setLabel("تفويض").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("jail:open:revoke").setLabel("سحب تفويض").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("jail:list").setLabel("السجناء").setStyle(ButtonStyle.Secondary),
  );
  await message.reply({ embeds: [embed], components: [row] });
}

async function replyMessage(message: Message, ok: boolean, text: string) {
  await message.reply({ embeds: [ok ? successEmbed("نظام السجن", text) : errorEmbed("نظام السجن", text)] }).catch(() => null);
}

export async function handleJailMessage(client: Client, message: Message): Promise<boolean> {
  if (message.author.bot || !message.guild || !message.member) return false;
  const config = await getJailConfig(message.guild.id);
  if (!config.enabled) return false;
  const inControlChannel = message.channel.id === config.controlChannelId || ("name" in message.channel && message.channel.name === CONTROL_CHANNEL_NAME);
  if (!inControlChannel) return false;

  if (!(await isJailAuthorized(message.member, config))) {
    await replyMessage(message, false, "ما عندك تفويض لاستخدام نظام السجن.");
    return true;
  }
  if (isRateLimited(message.guild.id, message.author.id)) {
    await replyMessage(message, false, "محاولات كثيرة خلال دقيقة. انتظر قليلاً.");
    return true;
  }

  const content = message.content.trim();
  try {
    if (content === "سجن") {
      await ensureJailResources(message.guild, config);
      await sendPanel(message);
      return true;
    }
    const [cmd, ...rest] = content.split(/\s+/);
    const arg = rest.join(" ");
    if (cmd === "تفويض") {
      const id = extractSnowflake(arg);
      if (!id) throw new Error("اكتب ID أو منشن العضو المراد تفويضه.");
      await replyMessage(message, true, await grantDelegate(message.guild, message.member, id));
      return true;
    }
    if (["سحب-تفويض", "سحب", "الغاء-تفويض", "إلغاء-تفويض"].includes(cmd ?? "")) {
      const id = extractSnowflake(arg);
      if (!id) throw new Error("اكتب ID أو منشن العضو المراد سحب تفويضه.");
      await replyMessage(message, true, await revokeDelegate(message.guild, message.member, id));
      return true;
    }
    if (["إطلاق", "اطلاق", "فك"].includes(cmd ?? "")) {
      const id = extractSnowflake(arg);
      if (!id) throw new Error("اكتب ID أو منشن العضو المراد إطلاقه.");
      const r = await releaseJail(message.guild, id, message.author.id, "إطلاق مبكر من قناة التحكم", "manual_release");
      await replyMessage(message, r.released, r.text);
      return true;
    }
    if (cmd === "سجناء") {
      await listActiveJailsMessage(message);
      return true;
    }
  } catch (err) {
    await replyMessage(message, false, err instanceof Error ? err.message : "تعذّر تنفيذ العملية.");
    return true;
  }
  return false;
}

async function listActiveJailsMessage(message: Message) {
  const { data, error } = await supabase
    .from("guild_jail_prisoners")
    .select("user_id,jailed_by_id,reason,expires_at")
    .eq("guild_id", message.guild!.id)
    .is("released_at", null)
    .order("expires_at", { ascending: true })
    .limit(10);
  if (error) throw new Error("تعذّر جلب السجناء.");
  const lines = (data ?? []).map((r) => `<@${r.user_id}> — ينتهي <t:${Math.floor(new Date(r.expires_at).getTime() / 1000)}:R> — بواسطة <@${r.jailed_by_id}>`).join("\n");
  await replyMessage(message, true, lines || "لا يوجد سجناء نشطين.");
}

function jailModal(kind: "jail" | "release" | "delegate" | "revoke") {
  const modal = new ModalBuilder().setCustomId(`jail:modal:${kind}`).setTitle(kind === "jail" ? "سجن عضو" : kind === "release" ? "إطلاق سراح" : kind === "delegate" ? "تفويض عضو" : "سحب تفويض");
  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(
    new TextInputBuilder().setCustomId("target").setLabel("User ID أو منشن العضو").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(80),
  ));
  if (kind === "jail") {
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId("duration").setLabel("المدة (مثال: 1h أو 24h أو 7d)").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(20)),
      new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId("reason").setLabel("السبب").setStyle(TextInputStyle.Paragraph).setRequired(true).setMinLength(3).setMaxLength(500)),
    );
  } else if (kind === "release") {
    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId("reason").setLabel("سبب الإطلاق المبكر").setStyle(TextInputStyle.Paragraph).setRequired(true).setMinLength(3).setMaxLength(300)));
  }
  return modal;
}

async function assertInteractionAllowed(interaction: ButtonInteraction | ModalSubmitInteraction): Promise<{ member: GuildMember; config: JailConfig } | null> {
  if (!interaction.guild || !(interaction.member instanceof GuildMember)) {
    await interaction.reply({ embeds: [errorEmbed("نظام السجن", "هذه العملية تعمل داخل السيرفر فقط.")], ephemeral: true });
    return null;
  }
  const config = await getJailConfig(interaction.guild.id, true);
  if (!config.enabled) {
    await interaction.reply({ embeds: [errorEmbed("نظام السجن", "نظام السجن غير مفعل من الداشبورد.")], ephemeral: true });
    return null;
  }
  if (interaction.channelId !== config.controlChannelId) {
    await interaction.reply({ embeds: [errorEmbed("نظام السجن", `استخدم روم ${CONTROL_CHANNEL_NAME} فقط.`)], ephemeral: true });
    return null;
  }
  if (!(await isJailAuthorized(interaction.member, config))) {
    await interaction.reply({ embeds: [errorEmbed("نظام السجن", "ما عندك تفويض لاستخدام نظام السجن.")], ephemeral: true });
    return null;
  }
  return { member: interaction.member, config };
}

export async function handleJailInteraction(interaction: Interaction): Promise<boolean> {
  if (!interaction.isButton() && !interaction.isModalSubmit()) return false;
  if (!interaction.customId.startsWith("jail:")) return false;

  try {
    if (interaction.isButton()) {
      const allowed = await assertInteractionAllowed(interaction);
      if (!allowed) return true;
      if (interaction.customId === "jail:list") {
        const { data } = await supabase.from("guild_jail_prisoners").select("user_id,expires_at").eq("guild_id", interaction.guildId!).is("released_at", null).order("expires_at", { ascending: true }).limit(10);
        const text = (data ?? []).map((r) => `<@${r.user_id}> — <t:${Math.floor(new Date(r.expires_at).getTime() / 1000)}:R>`).join("\n") || "لا يوجد سجناء نشطين.";
        await interaction.reply({ embeds: [infoEmbed("السجناء النشطون", text)], ephemeral: true });
        return true;
      }
      const kind = interaction.customId.replace("jail:open:", "") as "jail" | "release" | "delegate" | "revoke";
      await interaction.showModal(jailModal(kind));
      return true;
    }

    const allowed = await assertInteractionAllowed(interaction);
    if (!allowed) return true;
    await interaction.deferReply({ ephemeral: true });
    const targetId = extractSnowflake(interaction.fields.getTextInputValue("target"));
    if (!targetId) throw new Error("User ID غير صحيح.");
    const kind = interaction.customId.replace("jail:modal:", "");
    let text = "";
    if (kind === "jail") {
      const duration = parseDuration(interaction.fields.getTextInputValue("duration"));
      if (!duration) throw new Error("المدة لازم تكون بين ساعة وأسبوع. مثال: 1h أو 24h أو 7d.");
      text = await jailMember(interaction.guild!, allowed.member, targetId, duration, interaction.fields.getTextInputValue("reason").trim());
    } else if (kind === "release") {
      const r = await releaseJail(interaction.guild!, targetId, interaction.user.id, interaction.fields.getTextInputValue("reason").trim(), "manual_release");
      text = r.text;
    } else if (kind === "delegate") {
      text = await grantDelegate(interaction.guild!, allowed.member, targetId);
    } else if (kind === "revoke") {
      text = await revokeDelegate(interaction.guild!, allowed.member, targetId);
    }
    await interaction.editReply({ embeds: [successEmbed("نظام السجن", text)] });
  } catch (err) {
    const embed = errorEmbed("نظام السجن", err instanceof Error ? err.message : "تعذّر تنفيذ العملية.");
    if (interaction.isModalSubmit() && interaction.deferred) await interaction.editReply({ embeds: [embed] }).catch(() => null);
    else if (!interaction.replied) await interaction.reply({ embeds: [embed], ephemeral: true }).catch(() => null);
  }
  return true;
}

async function isSubscriptionInactive(guildId: string): Promise<boolean> {
  try {
    const instanceId = process.env.INSTANCE_ID;
    let query = supabase.from("bot_instances").select("status,expires_at").eq("product_type", "general").limit(1);
    query = instanceId ? query.eq("id", instanceId) : query.eq("guild_id", guildId);
    const { data, error } = await query.maybeSingle();
    if (error || !data) return false;
    if (data.status !== "active") return true;
    return Boolean(data.expires_at && new Date(data.expires_at).getTime() <= Date.now());
  } catch {
    return false;
  }
}

async function releaseAllActive(guild: Guild, reason: string, kind: string) {
  const { data, error } = await supabase.from("guild_jail_prisoners").select("user_id").eq("guild_id", guild.id).is("released_at", null).limit(100);
  if (error) return;
  for (const row of data ?? []) {
    await releaseJail(guild, String(row.user_id), null, reason, kind).catch((err) => Logger.warn(`Failed releaseAll jail ${row.user_id}: ${err}`));
  }
}

async function schedulerTick(client: Client) {
  const guild = Config.guildId ? client.guilds.cache.get(Config.guildId) ?? (await client.guilds.fetch(Config.guildId).catch(() => null)) : client.guilds.cache.first();
  if (!guild) return;

  const config = await getJailConfig(guild.id, true);
  if (await isSubscriptionInactive(guild.id)) {
    await releaseAllActive(guild, "انتهى/توقف اشتراك SystemBot", "subscription_inactive");
    return;
  }
  if (!config.enabled) {
    await releaseAllActive(guild, "تم تعطيل نظام السجن من الداشبورد", "feature_disabled");
    return;
  }

  await ensureJailResources(guild, config);
  const { data, error } = await supabase
    .from("guild_jail_prisoners")
    .select("*")
    .eq("guild_id", guild.id)
    .is("released_at", null)
    .lte("expires_at", new Date().toISOString())
    .limit(25);
  if (error) {
    Logger.warn(`Failed to load expired jail records: ${error.message}`);
    return;
  }
  for (const row of (data ?? []) as JailRecord[]) {
    await releaseJail(guild, row.user_id, null, "انتهت مدة السجن", "expired").catch((err) => Logger.warn(`Auto release failed for ${row.user_id}: ${err}`));
  }
}

export function startJailRuntime(client: Client) {
  if (schedulerStarted) return;
  schedulerStarted = true;
  schedulerTick(client).catch((err) => Logger.warn(`Jail scheduler tick failed: ${err}`));
  const timer = setInterval(() => schedulerTick(client).catch((err) => Logger.warn(`Jail scheduler tick failed: ${err}`)), SCHEDULER_MS);
  timer.unref?.();

  process.once("SIGTERM", () => {
    const forceExit = setTimeout(() => process.exit(0), 8_000);
    schedulerTick(client)
      .catch(() => null)
      .finally(() => {
        clearTimeout(forceExit);
        client.destroy();
        process.exit(0);
      });
  });
}
