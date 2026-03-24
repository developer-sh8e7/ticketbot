import type { GuildMember } from 'discord.js';
import type { AppConfig } from '../types/config.js';
import { uniqueStrings } from '../utils/text.js';

function hasAnyRole(member: GuildMember, roleIds: string[]): boolean {
  return uniqueStrings(roleIds).some((roleId) => member.roles.cache.has(roleId));
}

export function isSupportMember(member: GuildMember, config: AppConfig): boolean {
  return hasAnyRole(member, [...config.guild.supportRoleIds]);
}

export function isManagerMember(member: GuildMember, config: AppConfig): boolean {
  return hasAnyRole(member, [...config.guild.managerRoleIds]);
}

export function canManageTicket(member: GuildMember, config: AppConfig): boolean {
  return isSupportMember(member, config) || isManagerMember(member, config);
}

export function canManagePanels(member: GuildMember, config: AppConfig): boolean {
  return isManagerMember(member, config) || member.permissions.has('Administrator');
}
