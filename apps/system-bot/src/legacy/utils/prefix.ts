export function stripMessageCommandPrefix(
  content: string,
  prefixes: Array<string | null | undefined>,
): string {
  const trimmed = content.trim();
  if (!trimmed) return "";

  const seen = new Set<string>();
  for (const rawPrefix of prefixes) {
    const prefix = rawPrefix?.trim();
    if (!prefix || seen.has(prefix)) continue;
    seen.add(prefix);

    if (trimmed === prefix) return "";
    if (!trimmed.startsWith(prefix)) continue;

    const remainder = trimmed.slice(prefix.length);
    if (!remainder) return "";

    // Allow both "< سجن" and "<سجن", but don't treat Discord mentions
    // like <@123>, <#123>, <@&123>, or custom emojis as prefix commands.
    if (/^\s/.test(remainder) || /^[\p{L}\p{N}_-]/u.test(remainder)) {
      return remainder.trimStart();
    }
  }

  return trimmed;
}
