# Deploy `apps/web` to Vercel

This project should deploy **only the website** to Vercel. Discord bots stay on Railway/other bot hosting.

## Vercel project settings

If importing from GitHub, use these settings:

- **Root Directory:** `apps/web`
- **Framework Preset:** Next.js
- **Install Command:** `npm install`
- **Build Command:** `npm run build`
- **Output Directory:** `.next`

## Environment variables

Copy the names from `apps/web/.env.example` into:

`Vercel Project → Settings → Environment Variables`

Add them to **Production**. Add them to **Preview** too if you want preview deployments to work.

Required for the full site:

- `APP_URL` — use `https://opussolutions.xyz` after the domain is connected.
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `FIELD_ENCRYPTION_KEY`
- `TOKEN_ENCRYPTION_KEY`
- `SESSION_SECRET`
- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `DISCORD_REDIRECT_URI` — normally `https://opussolutions.xyz/api/auth/discord/callback`
- `PAYPAL_ENV=live`
- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`

Optional:

- `MANAGER_SYNC_URL`, `MANAGER_SYNC_SECRET` only if the running bot manager exposes a compatible sync webhook.
- `NVIDIA_API_KEY` for Opi chat.
- `DISCORD_WEBHOOK_LOGS`, `DISCORD_BUY_WEB` for Discord logs.
- `OWNER_DISCORD_ID`, `STORE_GUILD_ID`, `DEFAULT_PURCHASE_GUILD_ID`, `ADMIN_DISCORD_IDS` for admin/store behavior.

Generate secret values:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Use a different generated value for `FIELD_ENCRYPTION_KEY` and `SESSION_SECRET`. Keep the existing `TOKEN_ENCRYPTION_KEY` if bot tokens/subscriptions were already encrypted with it.

## Domain

In Vercel:

`Project → Settings → Domains → Add opussolutions.xyz`

Then follow the DNS records Vercel gives you. Usually:

- Apex/root domain `opussolutions.xyz`: `A` record to `76.76.21.21`
- `www`: `CNAME` to `cname.vercel-dns.com`

After domain is live:

1. Set `APP_URL=https://opussolutions.xyz` in Vercel.
2. Set `DISCORD_REDIRECT_URI=https://opussolutions.xyz/api/auth/discord/callback` in Vercel.
3. Add the same redirect URL in the Discord Developer Portal OAuth2 redirects.
4. Redeploy the latest Vercel deployment.
