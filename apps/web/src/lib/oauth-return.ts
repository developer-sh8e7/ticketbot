export function safeOAuthReturnTo(value: string | null | undefined, appUrl: string) {
  const fallback = '/dashboard';
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\') || /[\u0000-\u001f]/.test(value)) {
    return fallback;
  }
  try {
    const appOrigin = new URL(appUrl).origin;
    const target = new URL(value, appUrl);
    if (target.origin !== appOrigin) return fallback;
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return fallback;
  }
}
