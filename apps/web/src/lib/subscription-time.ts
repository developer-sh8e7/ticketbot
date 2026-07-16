const DAY_MS = 86_400_000;

export function daysLeft(expiresAt: string | null | undefined): number | null {
  if (!expiresAt) return null;
  return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / DAY_MS);
}

export function formatSubscriptionDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  return `${date.getUTCFullYear()}/${String(date.getUTCMonth() + 1).padStart(2, '0')}/${String(date.getUTCDate()).padStart(2, '0')}`;
}

export function remainingDaysText(expiresAt: string | null | undefined): string {
  const remaining = daysLeft(expiresAt);
  if (remaining === null) return 'غير محدود';
  if (remaining <= 0) return 'منتهي';
  if (remaining === 1) return 'يوم واحد';
  if (remaining === 2) return 'يومين';
  if (remaining <= 10) return `${remaining} ايام`;
  return `${remaining} يوم`;
}
