# Broadcast Bot — Design Spec

Date: 2026-07-05
Status: Approved (user waived section-by-section + review gate: "سو كل شي")

## Purpose

A new sellable product: **Broadcast Bot / بوت البرودكاست**. An admin types `!رسالة`,
is walked through a short conversation, and the bot DMs a message to server members
with a live-updating progress embed. Runs standalone for the owner's own server
(`npm run dev`) and is also sold multi-tenant via `@opus/orchestrator`, exactly like
the existing `ticket` / `voice_rooms` / `general` bots.

## ⚠️ Risk acknowledged

Mass-DMing members violates Discord ToS (spam) and can get a bot token — or the
account — banned. Because tokens come from a shared pool, a ban can affect the
product line. The user accepted this. We mitigate (not eliminate) the risk:
per-DM delay, skip bots, exclusion list, and a mandatory confirmation step.

## Decisions (from brainstorming)

- **Targeting:** chosen at send-time — **all members** OR **a specific role**.
- **Confirmation:** required. Summary (recipient count + message preview + exclusions) with تأكيد/إلغاء buttons.
- **Progress:** a single live-updating embed (bar + counts + "آخر مستلم: @x"). No message-per-person.
- **Command:** prefix `!رسالة` (conversational flow), admin-only.
- **Scope:** build everything at once — bot + store listing + orchestrator wiring + pricing.
- **Name / price:** "Broadcast Bot / بوت البرودكاست", $3/mo, $9/quarter.

## Architecture

New workspace `apps/broadcast-bot/`, mirroring `apps/system-bot/`:

| File | Role |
|------|------|
| `src/runtime.ts` | The Discord client: `!رسالة` flow + broadcast engine + progress embed. Logs in with `BOT_TOKEN`, serves `GUILD_ID`. |
| `src/bot.ts` | `createBroadcastBot: BotFactory` — spawns `runtime` as a child process per instance (used by the orchestrator). |
| `src/index.ts` | Standalone entry: reads `BROADCAST_DEV_TOKEN` + `BROADCAST_DEV_GUILD`, starts a health server, runs one instance via the factory. `npm run dev`. |
| `package.json`, `tsconfig.json` | `@opus/broadcast-bot`; deps `@opus/core`, `discord.js`, `@supabase/supabase-js`, `dotenv`. |

**Intents required (privileged — must be enabled per bot application in the Discord Developer Portal):**
`Guilds`, `GuildMembers` (privileged), `GuildMessages`, `MessageContent` (privileged), `DirectMessages`.

## Interaction flow (`runtime.ts`)

Triggered on `messageCreate` when content starts with `!رسالة`, inside a guild text
channel, from a member with the `Administrator` permission (else a short "no permission"
reply). One active session per user (guarded by an in-memory `Set`). Each step uses
discord.js `awaitMessages` / `awaitMessageComponent` with a 120s timeout; timeout cancels.

1. Prompt "اكتب الرسالة التي تريد إرسالها" → capture next message text.
2. Target buttons `[كل الأعضاء] [رتبة معينة]` → capture choice.
   - If role: prompt "منشن الرتبة أو اكتب آيديها" → parse role mention/id.
3. Prompt "منشن الأشخاص الذين لا تريد وصول الرسالة لهم، أو اكتب: تخطي" → parse mentions or skip.
4. Compute recipients (all non-bot members, or role holders, minus exclusions). Show a
   summary embed (count, message preview, target, exclusions) with `[تأكيد الإرسال] [إلغاء]`.
5. On confirm → run broadcast.
6. Final report embed (sent / failed / total, and up to N names that failed).

## Broadcast engine

- Iterate recipients; `member.send(message)` in a try/catch (DMs-closed → counts as failed).
- **Delay ~1200 ms between DMs** to reduce spam-flagging.
- Update the single progress embed at most every ~1.5 s (and once at the end) to respect edit rate limits.
- Progress bar: 20 segments `▰`/`▱` + percentage + `done/total` + "آخر مستلم: @tag".

## Store + orchestrator wiring

- `packages/core/src/types.ts`: add `'broadcast'` to `PRODUCT_TYPES`.
- `apps/orchestrator/src/botRegistry.ts`: `broadcast: createBroadcastBot`.
- `apps/orchestrator/src/controlBot.ts`: product label `broadcast: 'البرودكاست'`.
- `apps/web/src/lib/site-content.ts`: `ProductKey` += `'broadcast'`; new product entry (key `broadcast`, id `broadcast-bot`, $3/$9, features, icon `Megaphone`).
- `apps/web/src/lib/product-catalog.ts`: `CatalogProductType` += `'broadcast'`; `dbPlanIdFor` → `broadcast-${suffix}`.
- `apps/web/src/components/HomeProductsGrid.tsx`: add `broadcast: Megaphone` to the `icons` map.
- `db/schema/000_complete_schema.sql`: add `'broadcast'` to every `product_type` check constraint (table defs + the "ترقية القيود" upgrade block), and insert the `broadcast-bot` product row + `broadcast-monthly` (300¢) / `broadcast-quarterly` (900¢) plan rows.
- Root `package.json`: add `@opus/broadcast-bot` to `build`, `typecheck`, and a `dev:broadcast` script.

## Out of scope (YAGNI)

- Scheduling/recurring broadcasts, message templates, per-guild configurable prefix,
  analytics/history persistence, attachments/embeds in the broadcast body. Plain text only for v1.

## Verification

- `npm run typecheck` passes across all workspaces.
- Each bot workspace builds (`tsc`).
- Manual: `npm run dev -w @opus/broadcast-bot` with a dev token → `!رسالة` runs the full
  flow and DMs a small test role with the live progress embed.
