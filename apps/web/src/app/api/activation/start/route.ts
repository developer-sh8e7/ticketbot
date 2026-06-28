export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { activationCodeSchema } from '@/lib/validation';
import { fail, internalError, ok } from '@/lib/api-response';
import { verifyCsrf } from '@/lib/csrf';
import { rateLimit } from '@/lib/rate-limit';
import { supabaseAdmin } from '@/lib/supabase';
import { env, isProduction } from '@/lib/env';
import { logWebsiteEvent } from '@/lib/events';
import { hashField } from '@/lib/encryption';

export async function POST(req: NextRequest) {
  try {
    if (!verifyCsrf(req)) return fail('csrf_failed', 'Invalid CSRF token', 403);
    if (!rateLimit(req, 'activation:start', 8, 60_000).allowed) return fail('rate_limited', 'Too many activation attempts', 429);

    const body = await req.json().catch(() => ({}));
    const parsed = activationCodeSchema.safeParse(body.activation_code);
    if (!parsed.success) {
      await logWebsiteEvent({ eventType: 'invalid_activation_code', message: 'Invalid activation code format' });
      return fail('bad_request', 'Invalid activation code format', 400);
    }

    // Lookup by hash — never expose the plain code in queries
    const codeHash = hashField(parsed.data);
    const { data: code, error } = await supabaseAdmin()
      .from('activation_codes')
      .select('*')
      .eq('code_hash', codeHash)
      .maybeSingle();
    if (error) throw error;
    if (!code) {
      await logWebsiteEvent({ eventType: 'invalid_activation_code', message: 'Activation code not found' });
      return fail('not_found', 'Activation code was not found', 404);
    }
    if (['revoked', 'expired', 'cancelled'].includes(code.status)) return fail('forbidden', 'Activation code is not active', 403);

    const state = crypto.randomUUID();
    const discordUrl = new URL('https://discord.com/oauth2/authorize');
    discordUrl.searchParams.set('client_id', env().DISCORD_CLIENT_ID);
    discordUrl.searchParams.set('redirect_uri', env().DISCORD_REDIRECT_URI);
    discordUrl.searchParams.set('response_type', 'code');
    discordUrl.searchParams.set('scope', 'identify');
    discordUrl.searchParams.set('state', state);

    const res = ok({ redirect: discordUrl.toString(), status: code.status });
    // Store the plain code in an httpOnly cookie for the callback to use
    // (it will be hashed again at lookup time, never stored in DB)
    res.cookies.set('opus_activation_code', parsed.data, { httpOnly: true, secure: isProduction(), sameSite: 'lax', path: '/', maxAge: 60 * 10 });
    res.cookies.set('opus_oauth_state', state, { httpOnly: true, secure: isProduction(), sameSite: 'lax', path: '/', maxAge: 60 * 10 });
    return res;
  } catch (error) {
    console.error('[activation/start]', error);
    return internalError();
  }
}

export function GET() {
  return NextResponse.redirect(new URL('/login', env().APP_URL));
}
