# Opus Solutions Operations

## Local run
Package manager: npm (root `packageManager` is `npm@11.10.1`).

1. `npm install`
2. Apply SQL: `db/schema/000_complete_schema.sql` (single consolidated schema), then needed files from `db/product-schemas` and `db/source-ticket-sql`.
3. Copy `.env.example` to `.env` and fill Supabase, Discord OAuth, PayPal, token encryption and session secrets.
4. Start web: `npm run dev:web`.
5. Start orchestrator: `npm run dev:orchestrator`.

## Supabase
Core SaaS tables: `accounts`, `guilds`, `products`, `plans`, `subscriptions`, `bot_instances`, `token_pool`, `server_configs`, `payments`, `payment_events`, `service_events`, `feature_flags`, `product_configs`.
Original SQL from Ticket was preserved in `db/source-ticket-sql`; selected product schemas are also under `db/product-schemas`.

## Token pool
Add tokens only server-side with `TokenPoolRepository.addToken()` or encrypted SQL inserts. Claiming uses `claim_token(product_type, instance_id)` with `FOR UPDATE SKIP LOCKED` plus unique indexes, so concurrent purchases cannot receive the same token. Tokens are encrypted and never returned to customers.

## Subscriptions
PayPal capture verifies product/price server-side, writes `payments`, then calls `provision_instance`. Renewal reactivates the existing `(guild, product)` instance and keeps the same config/token when possible. Expiry sets subscription/instance inactive; config is retained in `server_configs`.

## Add tokens
Use an admin-only script importing `TokenPoolRepository` with `TOKEN_ENCRYPTION_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`; call `addToken({ productType, botApplicationId, plainToken })`.

## Add product
Add product to `PRODUCT_TYPES`, create package/factory, register in `apps/orchestrator/src/botRegistry.ts`, add product/plan SQL in `0004`, add website product in `apps/web/src/lib/site-content.ts`.

## Legacy server seed
`db/seed/config_1413059459630104626.json` contains the preserved config. Seed it into `server_configs` for `ticket`, `voice_rooms`, and/or `general`; do not overwrite it manually.
