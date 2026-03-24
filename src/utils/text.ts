export function padTicketNumber(ticketNumber: number, length: number): string {
  return String(ticketNumber).padStart(length, '0');
}

export function replaceTokens(template: string, tokens: Record<string, string | number>): string {
  let output = template;

  for (const [key, value] of Object.entries(tokens)) {
    output = output.replaceAll(`{${key}}`, String(value));
  }

  return output;
}

export function normalizeChannelName(input: string, maxLength: number): string {
  const normalized = input
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]+/gu, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  const safe = normalized || 'ticket';
  return safe.slice(0, maxLength);
}

export function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}

export function uniqueStrings(items: string[]): string[] {
  return [...new Set(items.filter(Boolean))];
}

export function formatRoleMentions(roleIds: string[]): string {
  return uniqueStrings(roleIds)
    .map((roleId) => `<@&${roleId}>`)
    .join(' ')
    .trim();
}

export function normalizeSnowflake(input: string): string | null {
  const trimmed = input.trim();
  const matched = trimmed.match(/^<@!?(\d+)>$/) ?? trimmed.match(/^(\d{16,20})$/);
  return matched?.[1] ?? null;
}

export function toCodeBlock(value: string): string {
  return `\`\`\`${value.replace(/\`\`\`/g, '```')}\`\`\``;
}
