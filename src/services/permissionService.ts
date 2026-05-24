import type { GuildMember } from 'discord.js';
import type { AppConfig } from '../types/config.js';
import { uniqueStrings } from '../utils/text.js';

function hasAnyRoleOrUserId(member: GuildMember, ids: string[]): boolean {
  return uniqueStrings(ids).some((id) => member.roles.cache.has(id) || member.id === id);
}

export function isSupportMember(member: GuildMember, config: AppConfig): boolean {
  return hasAnyRoleOrUserId(member, [...config.guild.supportRoleIds]);
}

export function isManagerMember(member: GuildMember, config: AppConfig): boolean {
  return hasAnyRoleOrUserId(member, [...config.guild.managerRoleIds]);
}

export function canManageTicket(member: GuildMember, config: AppConfig): boolean {
  return isSupportMember(member, config) || isManagerMember(member, config) || member.roles.cache.has('1507642618157465600');
}

export function canManagePanels(member: GuildMember, config: AppConfig): boolean {
  return isManagerMember(member, config) || member.permissions.has('Administrator');
}
