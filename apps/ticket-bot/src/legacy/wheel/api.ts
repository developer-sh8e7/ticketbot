import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_DIR = join(process.cwd(), 'web', 'wheel');
const COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000;

let supabase: SupabaseClient | null = null;

function wheelWebhookUrl(): string {
  return process.env.WHEEL_WEBHOOK_URL?.trim() || '';
}

function createWheelOAuthState(): string {
  const secret = process.env.SESSION_SECRET?.trim();
  if (!secret) throw new Error('SESSION_SECRET is required for wheel OAuth');
  const payload = Buffer.from(JSON.stringify({
    nonce: crypto.randomUUID(),
    expiresAt: Date.now() + 10 * 60 * 1000,
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function validateWheelOAuthState(state: string): boolean {
  const secret = process.env.SESSION_SECRET?.trim();
  const [payload, signature] = state.split('.');
  if (!secret || !payload || !signature) return false;
  const expectedSignature = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  const provided = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) return false;
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { expiresAt?: number };
    return typeof parsed.expiresAt === 'number' && parsed.expiresAt > Date.now();
  } catch {
    return false;
  }
}

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

export async function handleWheelRequest(url: URL, method: string, rawBody?: string, reqHeaders: Record<string, string | string[] | undefined> = {}): Promise<{ status: number; headers: Record<string, string>; body: string }> {
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

  if (path === '/api/wheel/achievements' && method === 'GET') {
    const discordId = url.searchParams.get('discord_id');
    if (!discordId) return json({ error: 'missing id' }, 400);

    const [achievements, userAchievements] = await Promise.all([
      supabase!.from('achievements').select('*').order('reward_xp', { ascending: false }),
      supabase!.from('user_achievements').select('achievement_id').eq('discord_id', discordId)
    ]);

    const unlocked = new Set((userAchievements.data || []).map((ua: any) => ua.achievement_id));
    const result = (achievements.data || []).map((a: any) => ({
      ...a,
      unlocked: unlocked.has(a.id)
    }));

    return json(result);
  }

  if (path === '/api/wheel/analytics' && method === 'GET') {
    const discordId = url.searchParams.get('discord_id');
    if (!discordId) return json({ error: 'missing id' }, 400);

    const [spins, user] = await Promise.all([
      supabase!.from('wheel_spins').select('*').eq('discord_id', discordId).order('spun_at', { ascending: false }),
      supabase!.from('wheel_users').select('*').eq('discord_id', discordId).single()
    ]);

    const rarityStats: Record<string, number> = {};
    (spins.data || []).forEach((s: any) => {
      rarityStats[s.rarity] = (rarityStats[s.rarity] || 0) + 1;
    });

    const total = spins.data?.length || 0;
    const tierStats: Record<number, number> = {};
    (spins.data || []).forEach((s: any) => {
      tierStats[s.tier] = (tierStats[s.tier] || 0) + 1;
    });

    return json({
      total_spins: total,
      rarity_distribution: rarityStats,
      tier_distribution: tierStats,
      best_rarity: Object.entries(rarityStats).sort((a: any, b: any) => b[1] - a[1])[0] || null,
      user: user.data
    });
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

  if (path === '/api/wheel/characters' && method === 'GET') {
    const { data } = await supabase!.from('brainrot_characters').select('*').gt('weight', 0).order('tier', { ascending: false });
    return json(data || []);
  }

  if (path === '/api/wheel/spin' && method === 'POST') {
    const body = rawBody ? JSON.parse(rawBody) : {};
    const discordId = body.discord_id;
    if (!discordId) return json({ error: 'missing discord_id' }, 400);

    const { data: userData } = await supabase!.from('wheel_users').select('*').eq('discord_id', discordId).single();
    if (!userData) return json({ error: 'user not found' }, 404);

    // Check cooldown
    const lastSpin = userData.last_spin_at ? new Date(userData.last_spin_at).getTime() : 0;
    const elapsed = Date.now() - lastSpin;
    if (elapsed < COOLDOWN_MS) {
      const remaining = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
      return json({ error: `cooldown: ${remaining}` }, 403);
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
      discord_id: discordId,
      character_id: sel.id,
      character_name: sel.name,
      rarity: sel.rarity,
      tier: sel.tier,
      weight: sel.weight,
      is_real: sel.is_real
    }).select('*, character:character_id(*)').single();

    if (spinError) return json({ error: spinError.message }, 500);

    // Update user data
    await supabase!.from('wheel_users').update({
      last_spin_at: new Date().toISOString(),
      total_spins: (userData.total_spins || 0) + 1,
      best_character_id: (!userData.best_character_id || sel.tier > (userData.best_tier || 0)) ? sel.id : userData.best_character_id
    }).eq('discord_id', discordId);

    const webhookUrl = wheelWebhookUrl();
    if (webhookUrl) {
      try {
        fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: `🎰 **NEW WINNER** | <@${discordId}> (\`${discordId}\`)`,
            embeds: [{
              title: `LOOT: ${sel.name}`,
              description: `**Winner:** <@${discordId}>\n**Tier:** ${sel.rarity}\n**Time:** ${new Date().toLocaleString()}\n**Character ID:** \`${sel.id}\`\n**Full Log:** \`SUCCESS\``,
              color: sel.tier === 6 ? 0xef4444 : sel.tier === 5 ? 0xf59e0b : sel.tier === 4 ? 0xa855f7 : sel.tier === 3 ? 0x3b82f6 : sel.tier === 2 ? 0x22c55e : 0x94a3b8,
              thumbnail: { url: avatar || sel.image_url },
              footer: { text: 'Steal the Brainrot Wheel Engine' },
              timestamp: new Date().toISOString()
            }]
          })
        }).catch(() => null);
      } catch {}
    }

    // Check achievements
    const { data: allAchievements } = await supabase!.from('achievements').select('*');
    const { data: unlocked } = await supabase!.from('user_achievements').select('achievement_id').eq('discord_id', discordId);
    const unlockedSet = new Set((unlocked || []).map((u: any) => u.achievement_id));

    for (const ach of (allAchievements || [])) {
      if (unlockedSet.has(ach.id)) continue;

      const req = ach.requirement as any;
      let achieved = false;

      if (req.type === 'total_spins') {
        if ((userData?.total_spins || 0) + 1 >= req.min) achieved = true;
      } else if (req.type === 'win_rarity' && sel.tier >= req.min_tier) {
        achieved = true;
      }

      if (achieved) {
        await supabase!.from('user_achievements').insert({
          discord_id: discordId,
          achievement_id: ach.id
        });
      }
    }

    return json({ ...(spinData as any), character: sel });
  }

  if (path === '/api/wheel/auth/discord' && method === 'GET') {
    const clientId = process.env.DISCORD_CLIENT_ID || '';
    if (!clientId) return json({ error: 'Discord OAuth is not configured' }, 503);
    const redirectUri = `${url.origin}/api/wheel/auth/callback`;
    const authorizeUrl = new URL('https://discord.com/oauth2/authorize');
    authorizeUrl.searchParams.set('client_id', clientId);
    authorizeUrl.searchParams.set('redirect_uri', redirectUri);
    authorizeUrl.searchParams.set('response_type', 'code');
    authorizeUrl.searchParams.set('scope', 'identify');
    authorizeUrl.searchParams.set('state', createWheelOAuthState());
    return { status: 302, headers: { Location: authorizeUrl.toString() }, body: '' };
  }

  if (path === '/api/wheel/auth/callback' && method === 'GET') {
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state') || '';
    if (!code || !validateWheelOAuthState(state)) return json({ error: 'invalid OAuth request' }, 400);

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
      const tokenData = await tokenRes.json() as any;

      const userRes = await fetch('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      if (!userRes.ok) throw new Error(await userRes.text());
      const discordUser = await userRes.json() as any;

      const avatarUrl = discordUser.avatar
        ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
        : `https://cdn.discordapp.com/embed/avatars/${(discordUser.discriminator || '0') % 5}.png`;

      await supabase!.from('wheel_users').upsert({
        discord_id: discordUser.id,
        discord_tag: discordUser.global_name || discordUser.username,
        avatar_url: avatarUrl
      }, { onConflict: 'discord_id' });

      const params = new URLSearchParams({
        id: discordUser.id,
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
