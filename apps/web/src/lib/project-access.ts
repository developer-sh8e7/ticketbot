import crypto from 'node:crypto';
import type { NextRequest, NextResponse } from 'next/server';
import { isProduction } from './env';

export const PROJECT_ACCESS_COOKIE = 'opus_project_access';

type ProjectAccess = { requestId: string; token: string };

export function newProjectAccessToken() {
  return crypto.randomBytes(32).toString('base64url');
}

export function readProjectAccesses(req: NextRequest): ProjectAccess[] {
  const raw = req.cookies.get(PROJECT_ACCESS_COOKIE)?.value ?? '';
  return raw.split(',').flatMap((entry) => {
    const separator = entry.indexOf('.');
    if (separator < 1) return [];
    const requestId = entry.slice(0, separator);
    const token = entry.slice(separator + 1);
    if (!/^[0-9a-f-]{36}$/i.test(requestId) || token.length < 32) return [];
    return [{ requestId, token }];
  });
}

export function readProjectAccess(req: NextRequest, requestId: string) {
  return readProjectAccesses(req).find((access) => access.requestId === requestId) ?? null;
}

export function setProjectAccessCookie(req: NextRequest, res: NextResponse, requestId: string, token: string) {
  const previous = readProjectAccesses(req).filter((access) => access.requestId !== requestId);
  const entries = [{ requestId, token }, ...previous].slice(0, 20);
  res.cookies.set(PROJECT_ACCESS_COOKIE, entries.map((access) => `${access.requestId}.${access.token}`).join(','), {
    httpOnly: true,
    secure: isProduction(),
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 90,
  });
}
