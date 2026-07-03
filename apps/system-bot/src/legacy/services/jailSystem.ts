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
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  TextChannel,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder,
  UserSelectMenuInteraction,
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
const JAIL_QUOTA_WINDOW_MS = 5 * 60 * 60 * 1000;
const JAIL_QUOTA_MAX = 10;
const DRAFT_TTL_MS = 10 * 60 * 1000;
const SNOWFLAKE = /^\d{17,20}$/;

const DURATION_OPTIONS = [
  { label: "ساعة واحدة", value: "1h", ms: 1 * 60 * 60 * 1000 },
  { label: "ساعتين", value: "2h", ms: 2 * 60 * 60 * 1000 },
  { label: "3 ساعات", value: "3h", ms: 3 * 60 * 60 * 1000 },
  { label: "6 ساعات", value: "6h", ms: 6 * 60 * 60 * 1000 },
  { label: "12 ساعة", value: "12h", ms: 12 * 60 * 60 * 1000 },
  { label: "يوم", value: "1d", ms: 24 * 60 * 60 * 1000 },
  { label: "يومين", value: "2d", ms: 2 * 24 * 60 * 60 * 1000 },
  { label: "3 أيام", value: "3d", ms: 3 * 24 * 60 * 60 * 1000 },
  { label: "أسبوع", value: "7d", ms: 7 * 24 * 60 * 60 * 1000 },
] as const;

const jailConfigCache = new Map<string, { config: JailConfig; expiresAt: number }>();
const jailRoleDenySync = new Map<string, number>();
const jailDrafts = new Map<string, JailDraft>();
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

type JailDraft = {
  guildId: string;
  actorId: string;
  targetId?: string;
  durationMs?: number;
  createdAt: number;
};

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? Array.from(new Set(value.map((v) => String(v)).filter((v) => SNOWFLAKE.test(v)))).slice(0, 80) : [];
}

function defaultConfig(): JailConfig {
  return { enabled: false, allowedRoleIds: [], allowedUserIds: [] };
}

function createDraft(guildId: string, actorId: string): string {
  cleanupDrafts();
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  jailDrafts.set(id, { guildId, actorId, createdAt: Date.now() });
  return id;
}

function getDraft(id: string): JailDraft | null {
  const draft = jailDrafts.get(id);
  if (!draft) return null;
  if (Date.now() - draft.createdAt > DRAFT_TTL_MS) {
    jailDrafts.delete(id);
    return null;
  }
  return draft;
}

function cleanupDrafts() {
  const now = Date.now();
  for (const [id, draft] of jailDrafts) {
    if (now - draft.createdAt > DRAFT_TTL_MS) jailDrafts.delete(id);
  }
}

function getDurationByValue(value: string): number | null {
  return DURATION_OPTIONS.find((option) => option.value === value)?.ms ?? null;
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

function canManageJailDelegates(member: GuildMember, config: JailConfig): boolean {
  if (!config.enabled) return false;
  return member.id === member.guild.ownerId || isOwner(member.id) || memberMatchesDashboardAllow(member, config);
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

async function ensureJailQuota(guildId: string, actorId: string) {
  const since = new Date(Date.now() - JAIL_QUOTA_WINDOW_MS).toISOString();
  const { count, error } = await supabase
    .from("guild_jail_audit")
    .select("id", { count: "exact", head: true })
    .eq("guild_id", guildId)
    .eq("actor_id", actorId)
    .eq("action", "jail")
    .gte("created_at", since);
  if (error) throw new Error("تعذّر التحقق من حد السجن المؤقت. جرّب بعد قليل.");
  if ((count ?? 0) >= JAIL_QUOTA_MAX) throw new Error(`وصلت للحد: ${JAIL_QUOTA_MAX} سجناء كل 5 ساعات لكل مفوّض.`);
}

async function controlLogChannel(guild: Guild, config?: JailConfig): Promise<TextChannel | null> {
  const jailConfig = config ?? await getJailConfig(guild.id, true);
  const { channel } = await ensureJailResources(guild, jailConfig);
  if (channel) return channel;
  const fallback = guild.channels.cache.find((c) => c.type === ChannelType.GuildText && c.name === CONTROL_CHANNEL_NAME);
  return fallback?.type === ChannelType.GuildText ? fallback as TextChannel : null;
}

async function sendJailLog(guild: Guild, input: { actor: GuildMember; target: GuildMember; durationMs: number; reason: string; expiresAt: string; originalRoleCount: number }) {
  const channel = await controlLogChannel(guild);
  if (!channel) return;
  const expiresUnix = Math.floor(new Date(input.expiresAt).getTime() / 1000);
  const nowUnix = Math.floor(Date.now() / 1000);
  const embed = new EmbedBuilder()
    .setAuthor({ name: `${input.actor.user.tag} سجن عضو`, iconURL: input.actor.displayAvatarURL() })
    .setTitle("سجل سجن جديد")
    .setDescription(`${input.target} تم سجنه بواسطة ${input.actor}`)
    .addFields(
      { name: "المسجون", value: `${input.target}\n\`${input.target.id}\``, inline: true },
      { name: "بواسطة", value: `${input.actor}\n\`${input.actor.id}\``, inline: true },
      { name: "المدة", value: durationText(input.durationMs), inline: true },
      { name: "وقت السجن", value: `<t:${nowUnix}:F>`, inline: true },
      { name: "ينتهي", value: `<t:${expiresUnix}:F>\n<t:${expiresUnix}:R>`, inline: true },
      { name: "عدد الرتب المحفوظة", value: String(input.originalRoleCount), inline: true },
      { name: "السبب", value: input.reason.slice(0, 1000), inline: false },
    )
    .setThumbnail(input.target.displayAvatarURL({ size: 256 }))
    .setColor(Colors.error)
    .setFooter({ text: Config.embed.footer })
    .setTimestamp();
  await channel.send({ content: `${input.target} ${input.actor}`, embeds: [embed], allowedMentions: { users: [input.target.id, input.actor.id] } }).catch(() => null);
}

async function sendReleaseLog(guild: Guild, input: { targetId: string; actorId: string | null; reason: string; kind: string; skippedRoleIds: string[] }) {
  const channel = await controlLogChannel(guild);
  if (!channel) return;
  const target = await guild.members.fetch(input.targetId).catch(() => null);
  const actor = input.actorId ? await guild.members.fetch(input.actorId).catch(() => null) : null;
  const title = input.kind === "expired" ? "إطلاق تلقائي — انتهت المدة" : "إطلاق سراح";
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(`<@${input.targetId}> تم فك سجنه${actor ? ` بواسطة ${actor}` : " تلقائياً"}.`)
    .addFields(
      { name: "العضو", value: `<@${input.targetId}>\n\`${input.targetId}\``, inline: true },
      { name: "بواسطة", value: actor ? `${actor}\n\`${actor.id}\`` : "SystemBot", inline: true },
      { name: "السبب", value: input.reason.slice(0, 1000), inline: false },
    )
    .setThumbnail(target?.displayAvatarURL({ size: 256 }) ?? null)
    .setColor(input.kind === "expired" ? Colors.success : Colors.warning)
    .setFooter({ text: Config.embed.footer })
    .setTimestamp();
  if (input.skippedRoleIds.length) embed.addFields({ name: "رتب لم ترجع", value: input.skippedRoleIds.join(", ").slice(0, 1000), inline: false });
  await channel.send({ content: `<@${input.targetId}>${actor ? ` ${actor}` : ""}`, embeds: [embed], allowedMentions: { users: [input.targetId, ...(actor ? [actor.id] : [])] } }).catch(() => null);
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
  await ensureJailQuota(guild.id, actor.id);

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
  await sendJailLog(guild, { actor, target, durationMs, reason, expiresAt, originalRoleCount: originalRoleIds.length });
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
  await sendReleaseLog(guild, { targetId, actorId, reason, kind, skippedRoleIds });
  return { text: `تم إطلاق سراح <@${targetId}>.${skippedRoleIds.length ? `\nتنبيه: بعض الرتب لم ترجع لأنها محذوفة/غير قابلة للإدارة: ${skippedRoleIds.join(", ")}` : ""}`, released: true };
}

async function grantDelegate(guild: Guild, actor: GuildMember, targetId: string, config?: JailConfig): Promise<string> {
  const jailConfig = config ?? await getJailConfig(guild.id, true);
  if (!canManageJailDelegates(actor, jailConfig)) throw new Error("التفويض والسحب مسموح فقط لمن تم تحديده من داشبورد الموقع، وليس للمفوّضين من Discord.");
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

async function revokeDelegate(guild: Guild, actor: GuildMember, targetId: string, config?: JailConfig): Promise<string> {
  const jailConfig = config ?? await getJailConfig(guild.id, true);
  if (!canManageJailDelegates(actor, jailConfig)) throw new Error("سحب التفويض مسموح فقط لمن تم تحديده من داشبورد الموقع، وليس للمفوّضين من Discord.");
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

function jailDraftComponents(draftId: string) {
  const targetRow = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
    new UserSelectMenuBuilder()
      .setCustomId(`jail:target:${draftId}`)
      .setPlaceholder("اختر العضو المراد سجنه")
      .setMinValues(1)
      .setMaxValues(1),
  );
  const durationRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`jail:duration:${draftId}`)
      .setPlaceholder("اختر مدة السجن")
      .addOptions(DURATION_OPTIONS.map((option) => ({ label: option.label, value: option.value, description: `سجن لمدة ${option.label}` }))),
  );
  const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`jail:reason:${draftId}`).setLabel("اكتب السبب ونفّذ السجن").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("jail:open:release").setLabel("إطلاق سراح").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("jail:open:delegate").setLabel("تفويض").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("jail:open:revoke").setLabel("سحب تفويض").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("jail:list").setLabel("السجناء").setStyle(ButtonStyle.Secondary),
  );
  return [targetRow, durationRow, actionRow];
}

function jailPanelEmbed(actor: GuildMember) {
  return new EmbedBuilder()
    .setTitle("نظام السجن")
    .setDescription([
      `${actor} اختر العضو والمدة من القوائم، ثم اضغط زر السبب والتنفيذ.`,
      `الحد: **${JAIL_QUOTA_MAX} سجناء لكل مفوّض كل 5 ساعات**.`,
      `روم **${CONTROL_CHANNEL_NAME}** صار لوق مرتب لكل عمليات السجن والإطلاق.`,
    ].join("\n"))
    .setColor(Colors.info)
    .setFooter({ text: Config.embed.footer })
    .setTimestamp();
}

async function sendPanel(message: Message, actor: GuildMember) {
  const draftId = createDraft(message.guild!.id, actor.id);
  await message.reply({ embeds: [jailPanelEmbed(actor)], components: jailDraftComponents(draftId) });
}

async function memberOptionLabel(guild: Guild, userId: string): Promise<string> {
  const member = guild.members.cache.get(userId) ?? await guild.members.fetch(userId).catch(() => null);
  return (member?.user.tag ?? member?.displayName ?? userId).slice(0, 90);
}

async function activeJailOptions(guild: Guild) {
  const { data, error } = await supabase
    .from("guild_jail_prisoners")
    .select("user_id,jailed_by_id,reason,expires_at")
    .eq("guild_id", guild.id)
    .is("released_at", null)
    .order("expires_at", { ascending: true })
    .limit(25);
  if (error) throw new Error("تعذّر جلب السجناء النشطين.");
  const rows = data ?? [];
  return Promise.all(rows.map(async (row) => ({
    label: await memberOptionLabel(guild, String(row.user_id)),
    value: String(row.user_id),
    description: `ينتهي ${new Date(row.expires_at).toLocaleString("ar")} · ${(row.reason ?? "بدون سبب").slice(0, 45)}`.slice(0, 100),
  })));
}

async function delegateOptions(guild: Guild) {
  const { data, error } = await supabase
    .from("guild_jail_delegates")
    .select("user_id,granted_by_id,created_at")
    .eq("guild_id", guild.id)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .limit(25);
  if (error) throw new Error("تعذّر جلب التفويضات النشطة.");
  const rows = data ?? [];
  return Promise.all(rows.map(async (row) => ({
    label: await memberOptionLabel(guild, String(row.user_id)),
    value: String(row.user_id),
    description: `مفوّض بواسطة ${row.granted_by_id}`.slice(0, 100),
  })));
}

async function releaseWorkflow(guild: Guild, actor: GuildMember) {
  const options = await activeJailOptions(guild);
  if (options.length === 0) return { embeds: [infoEmbed("إطلاق سراح", "لا يوجد سجناء نشطين حالياً.")], components: [] };
  const draftId = createDraft(guild.id, actor.id);
  const embed = new EmbedBuilder()
    .setTitle("إطلاق سراح")
    .setDescription("اختر المسجون من القائمة، ثم اضغط زر كتابة السبب لإطلاقه بشكل مرتب.")
    .setColor(Colors.success)
    .setFooter({ text: Config.embed.footer })
    .setTimestamp();
  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(new StringSelectMenuBuilder().setCustomId(`jail:releaseTarget:${draftId}`).setPlaceholder("اختر المسجون المراد إطلاقه").addOptions(options)),
      new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(`jail:releaseReason:${draftId}`).setLabel("اكتب سبب الإطلاق ونفّذ").setStyle(ButtonStyle.Success)),
    ],
  };
}

function delegateWorkflow(guild: Guild, actor: GuildMember) {
  const draftId = createDraft(guild.id, actor.id);
  const embed = new EmbedBuilder()
    .setTitle("تفويض استخدام السجن")
    .setDescription("اختر العضو من القائمة ثم اضغط تأكيد. ملاحظة: المفوّض يقدر يسجن فقط، ولا يقدر يعطي/يسحب تفويض.")
    .setColor(Colors.info)
    .setFooter({ text: Config.embed.footer })
    .setTimestamp();
  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(new UserSelectMenuBuilder().setCustomId(`jail:delegateTarget:${draftId}`).setPlaceholder("اختر العضو المراد تفويضه").setMinValues(1).setMaxValues(1)),
      new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(`jail:delegateConfirm:${draftId}`).setLabel("تأكيد التفويض").setStyle(ButtonStyle.Primary)),
    ],
  };
}

async function revokeWorkflow(guild: Guild, actor: GuildMember) {
  const options = await delegateOptions(guild);
  if (options.length === 0) return { embeds: [infoEmbed("سحب تفويض", "لا يوجد تفويضات Discord نشطة حالياً.")], components: [] };
  const draftId = createDraft(guild.id, actor.id);
  const embed = new EmbedBuilder()
    .setTitle("سحب تفويض")
    .setDescription("اختر المفوّض من القائمة ثم اضغط تأكيد سحب التفويض.")
    .setColor(Colors.warning)
    .setFooter({ text: Config.embed.footer })
    .setTimestamp();
  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(new StringSelectMenuBuilder().setCustomId(`jail:revokeTarget:${draftId}`).setPlaceholder("اختر التفويض المراد سحبه").addOptions(options)),
      new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(`jail:revokeConfirm:${draftId}`).setLabel("تأكيد سحب التفويض").setStyle(ButtonStyle.Danger)),
    ],
  };
}

async function replyMessage(message: Message, ok: boolean, text: string) {
  await message.reply({ embeds: [ok ? successEmbed("نظام السجن", text) : errorEmbed("نظام السجن", text)] }).catch(() => null);
}

export async function handleJailMessage(client: Client, message: Message): Promise<boolean> {
  if (message.author.bot || !message.guild || !message.member) return false;
  const content = message.content.trim();
  if (!content) return false;

  const config = await getJailConfig(message.guild.id);
  if (!config.enabled) return false;
  const inControlChannel = message.channel.id === config.controlChannelId || ("name" in message.channel && message.channel.name === CONTROL_CHANNEL_NAME);
  const [cmd, ...rest] = content.split(/\s+/);

  if (content !== "سجن" && !inControlChannel) return false;

  if (!(await isJailAuthorized(message.member, config))) {
    await replyMessage(message, false, "ما عندك تفويض لاستخدام نظام السجن.");
    return true;
  }

  try {
    if (content === "سجن") {
      await ensureJailResources(message.guild, config);
      await sendPanel(message, message.member);
      return true;
    }

    const arg = rest.join(" ");
    if (cmd === "تفويض") {
      const id = extractSnowflake(arg);
      if (!id) throw new Error("اكتب ID أو منشن العضو المراد تفويضه.");
      await replyMessage(message, true, await grantDelegate(message.guild, message.member, id, config));
      return true;
    }
    if (["سحب-تفويض", "سحب", "الغاء-تفويض", "إلغاء-تفويض"].includes(cmd ?? "")) {
      const id = extractSnowflake(arg);
      if (!id) throw new Error("اكتب ID أو منشن العضو المراد سحب تفويضه.");
      await replyMessage(message, true, await revokeDelegate(message.guild, message.member, id, config));
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

function jailReasonModal(draftId: string) {
  return new ModalBuilder()
    .setCustomId(`jail:modal:session:${draftId}`)
    .setTitle("سبب السجن")
    .addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId("reason").setLabel("ليش انسجن؟").setStyle(TextInputStyle.Paragraph).setRequired(true).setMinLength(3).setMaxLength(500),
    ));
}

function releaseReasonModal(draftId: string) {
  return new ModalBuilder()
    .setCustomId(`jail:modal:release-session:${draftId}`)
    .setTitle("سبب إطلاق السراح")
    .addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId("reason").setLabel("سبب الإطلاق المبكر").setStyle(TextInputStyle.Paragraph).setRequired(true).setMinLength(3).setMaxLength(300),
    ));
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

async function assertInteractionAllowed(interaction: ButtonInteraction | ModalSubmitInteraction | StringSelectMenuInteraction | UserSelectMenuInteraction): Promise<{ member: GuildMember; config: JailConfig } | null> {
  if (!interaction.guild || !(interaction.member instanceof GuildMember)) {
    await interaction.reply({ embeds: [errorEmbed("نظام السجن", "هذه العملية تعمل داخل السيرفر فقط.")], ephemeral: true });
    return null;
  }
  const config = await getJailConfig(interaction.guild.id, true);
  if (!config.enabled) {
    await interaction.reply({ embeds: [errorEmbed("نظام السجن", "نظام السجن غير مفعل من الداشبورد.")], ephemeral: true });
    return null;
  }
  if (!(await isJailAuthorized(interaction.member, config))) {
    await interaction.reply({ embeds: [errorEmbed("نظام السجن", "ما عندك تفويض لاستخدام نظام السجن.")], ephemeral: true });
    return null;
  }
  return { member: interaction.member, config };
}

export async function handleJailInteraction(interaction: Interaction): Promise<boolean> {
  if (!interaction.isButton() && !interaction.isModalSubmit() && !interaction.isStringSelectMenu() && !interaction.isUserSelectMenu()) return false;
  if (!interaction.customId.startsWith("jail:")) return false;

  try {
    if (interaction.isUserSelectMenu() || interaction.isStringSelectMenu()) {
      const allowed = await assertInteractionAllowed(interaction);
      if (!allowed) return true;
      const [, type, draftId] = interaction.customId.split(":");
      const draft = draftId ? getDraft(draftId) : null;
      if (!draft || draft.guildId !== interaction.guildId || draft.actorId !== interaction.user.id) {
        await interaction.reply({ embeds: [errorEmbed("نظام السجن", "هذه القائمة خاصة بالشخص الذي فتح أمر سجن أو انتهت صلاحيتها.")], ephemeral: true });
        return true;
      }
      if ((type === "target" || type === "delegateTarget") && interaction.isUserSelectMenu()) {
        draft.targetId = interaction.values[0];
        await interaction.reply({ content: `تم اختيار العضو: <@${draft.targetId}>`, ephemeral: true, allowedMentions: { users: [draft.targetId!] } });
        return true;
      }
      if ((type === "releaseTarget" || type === "revokeTarget") && interaction.isStringSelectMenu()) {
        draft.targetId = interaction.values[0];
        await interaction.reply({ content: `تم الاختيار: <@${draft.targetId}>`, ephemeral: true, allowedMentions: { users: [draft.targetId!] } });
        return true;
      }
      if (type === "duration" && interaction.isStringSelectMenu()) {
        const duration = getDurationByValue(interaction.values[0] ?? "");
        if (!duration) throw new Error("مدة غير صحيحة.");
        draft.durationMs = duration;
        await interaction.reply({ content: `تم اختيار المدة: ${durationText(duration)}`, ephemeral: true });
        return true;
      }
    }

    if (interaction.isButton()) {
      const allowed = await assertInteractionAllowed(interaction);
      if (!allowed) return true;
      if (interaction.customId === "jail:list") {
        const { data } = await supabase.from("guild_jail_prisoners").select("user_id,expires_at").eq("guild_id", interaction.guildId!).is("released_at", null).order("expires_at", { ascending: true }).limit(10);
        const text = (data ?? []).map((r) => `<@${r.user_id}> — <t:${Math.floor(new Date(r.expires_at).getTime() / 1000)}:R>`).join("\n") || "لا يوجد سجناء نشطين.";
        await interaction.reply({ embeds: [infoEmbed("السجناء النشطون", text)], ephemeral: true });
        return true;
      }
      if (interaction.customId === "jail:open:jail") {
        const draftId = createDraft(interaction.guildId!, interaction.user.id);
        await interaction.reply({ embeds: [jailPanelEmbed(allowed.member)], components: jailDraftComponents(draftId), ephemeral: true });
        return true;
      }
      if (interaction.customId.startsWith("jail:reason:")) {
        const draftId = interaction.customId.replace("jail:reason:", "");
        const draft = getDraft(draftId);
        if (!draft || draft.guildId !== interaction.guildId || draft.actorId !== interaction.user.id) {
          await interaction.reply({ embeds: [errorEmbed("نظام السجن", "هذا الطلب خاص بالشخص الذي فتح أمر سجن أو انتهت صلاحيته.")], ephemeral: true });
          return true;
        }
        if (!draft.targetId || !draft.durationMs) {
          await interaction.reply({ embeds: [errorEmbed("نظام السجن", "اختر العضو والمدة أولاً من القوائم.")], ephemeral: true });
          return true;
        }
        await interaction.showModal(jailReasonModal(draftId));
        return true;
      }
      if (interaction.customId === "jail:open:release") {
        await interaction.reply({ ...(await releaseWorkflow(interaction.guild!, allowed.member)), ephemeral: true });
        return true;
      }
      if (interaction.customId === "jail:open:delegate") {
        if (!canManageJailDelegates(allowed.member, allowed.config)) {
          await interaction.reply({ embeds: [errorEmbed("نظام السجن", "التفويض مسموح فقط لمن تم تحديده من داشبورد الموقع.")], ephemeral: true });
          return true;
        }
        await interaction.reply({ ...delegateWorkflow(interaction.guild!, allowed.member), ephemeral: true });
        return true;
      }
      if (interaction.customId === "jail:open:revoke") {
        if (!canManageJailDelegates(allowed.member, allowed.config)) {
          await interaction.reply({ embeds: [errorEmbed("نظام السجن", "سحب التفويض مسموح فقط لمن تم تحديده من داشبورد الموقع.")], ephemeral: true });
          return true;
        }
        await interaction.reply({ ...(await revokeWorkflow(interaction.guild!, allowed.member)), ephemeral: true });
        return true;
      }
      if (interaction.customId.startsWith("jail:releaseReason:")) {
        const draftId = interaction.customId.replace("jail:releaseReason:", "");
        const draft = getDraft(draftId);
        if (!draft || draft.guildId !== interaction.guildId || draft.actorId !== interaction.user.id) {
          await interaction.reply({ embeds: [errorEmbed("نظام السجن", "هذا الطلب خاص بالشخص الذي فتح إجراء الإطلاق أو انتهت صلاحيته.")], ephemeral: true });
          return true;
        }
        if (!draft.targetId) {
          await interaction.reply({ embeds: [errorEmbed("نظام السجن", "اختر المسجون من القائمة أولاً.")], ephemeral: true });
          return true;
        }
        await interaction.showModal(releaseReasonModal(draftId));
        return true;
      }
      if (interaction.customId.startsWith("jail:delegateConfirm:")) {
        const draftId = interaction.customId.replace("jail:delegateConfirm:", "");
        const draft = getDraft(draftId);
        if (!draft || draft.guildId !== interaction.guildId || draft.actorId !== interaction.user.id) throw new Error("طلب التفويض انتهت صلاحيته.");
        if (!draft.targetId) throw new Error("اختر العضو المراد تفويضه أولاً.");
        const text = await grantDelegate(interaction.guild!, allowed.member, draft.targetId, allowed.config);
        jailDrafts.delete(draftId);
        await interaction.reply({ embeds: [successEmbed("نظام السجن", text)], ephemeral: true });
        return true;
      }
      if (interaction.customId.startsWith("jail:revokeConfirm:")) {
        const draftId = interaction.customId.replace("jail:revokeConfirm:", "");
        const draft = getDraft(draftId);
        if (!draft || draft.guildId !== interaction.guildId || draft.actorId !== interaction.user.id) throw new Error("طلب سحب التفويض انتهت صلاحيته.");
        if (!draft.targetId) throw new Error("اختر التفويض المراد سحبه أولاً.");
        const text = await revokeDelegate(interaction.guild!, allowed.member, draft.targetId, allowed.config);
        jailDrafts.delete(draftId);
        await interaction.reply({ embeds: [successEmbed("نظام السجن", text)], ephemeral: true });
        return true;
      }
      return true;
    }

    if (!interaction.isModalSubmit()) return true;
    const allowed = await assertInteractionAllowed(interaction);
    if (!allowed) return true;
    await interaction.deferReply({ ephemeral: true });

    if (interaction.customId.startsWith("jail:modal:session:")) {
      const draftId = interaction.customId.replace("jail:modal:session:", "");
      const draft = getDraft(draftId);
      if (!draft || draft.guildId !== interaction.guildId || draft.actorId !== interaction.user.id) throw new Error("طلب السجن انتهت صلاحيته. اكتب سجن من جديد.");
      if (!draft.targetId || !draft.durationMs) throw new Error("اختر العضو والمدة أولاً من القوائم.");
      const text = await jailMember(interaction.guild!, allowed.member, draft.targetId, draft.durationMs, interaction.fields.getTextInputValue("reason").trim());
      jailDrafts.delete(draftId);
      await interaction.editReply({ embeds: [successEmbed("نظام السجن", text)] });
      return true;
    }

    if (interaction.customId.startsWith("jail:modal:release-session:")) {
      const draftId = interaction.customId.replace("jail:modal:release-session:", "");
      const draft = getDraft(draftId);
      if (!draft || draft.guildId !== interaction.guildId || draft.actorId !== interaction.user.id) throw new Error("طلب الإطلاق انتهت صلاحيته.");
      if (!draft.targetId) throw new Error("اختر المسجون من القائمة أولاً.");
      const r = await releaseJail(interaction.guild!, draft.targetId, interaction.user.id, interaction.fields.getTextInputValue("reason").trim(), "manual_release");
      jailDrafts.delete(draftId);
      await interaction.editReply({ embeds: [r.released ? successEmbed("نظام السجن", r.text) : errorEmbed("نظام السجن", r.text)] });
      return true;
    }

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
      text = await grantDelegate(interaction.guild!, allowed.member, targetId, allowed.config);
    } else if (kind === "revoke") {
      text = await revokeDelegate(interaction.guild!, allowed.member, targetId, allowed.config);
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
