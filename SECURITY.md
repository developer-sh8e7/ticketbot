# Security

## Verification Boundary

Completing Discord OAuth and WhatsApp OTP verification does not grant the
mediator role. It only allows the verified member to open an application
ticket. `MEDIATOR_ROLE_ID` is assigned exclusively after an authorized staff
member accepts that application in Discord.

## Controls

- SQL injection: Supabase parameterized query builders are used for all input.
- XSS: strict CSP, external scripts, text-only DOM updates, and input cleanup.
- CSRF: signed OAuth state, SameSite cookies, and a JWT-bound CSRF token.
- Session fixation: the Express session is regenerated after Discord OAuth.
- Session hijacking: `__Host-` cookies are Secure, HttpOnly, and SameSite.
- JWT downgrade: verification explicitly accepts HS512 only.
- JWT replay: every JWT contains a random `jti` whose keyed hash and expiry are
  checked against Supabase on each protected request.
- OTP brute force: three attempts, server-side expiry, per-route limits,
  progressive delay, and database-backed IP limits.
- OTP cross-account reuse: OTP lookup is bound to both the phone lookup hash
  and the authenticated Discord ID.
- Phone harvesting: the stored phone value uses bcrypt cost 12; duplicate
  detection uses a non-reversible HMAC lookup value.
- Sensitive logs: phone numbers, Discord IDs, OTP values, JWTs, secrets, and
  authorization values are automatically masked by Winston.
- Mass assignment: Zod strict schemas whitelist accepted request properties.
- Open redirect: server-generated redirects use the configured `/verify` URL.
- Clickjacking: CSP framing is disabled and `X-Frame-Options` is `DENY`.
- Transport security: HSTS, Secure cookies, and strict referrer policy.
- HTTP parameter pollution: HPP middleware is enabled.
- Discord OAuth minimization: the wheel requests `identify` only and never
  stores access tokens, refresh tokens, email, guild lists, connections, IP
  geolocation, or browser evidence.
- Race conditions: application decisions update only rows still in `open`
  status, and mediator count increments through a database function.
- Dependencies: `npm audit` is run before release and must report no known
  vulnerabilities.

## Secrets

Never commit `.env`, Discord tokens, OAuth secrets, Twilio credentials,
Supabase service keys, webhook URLs, `SESSION_SECRET`, or `JWT_SECRET`.
Rotate a secret immediately if it is exposed in a message, log, screenshot, or
commit.

## Database Setup

Run `supabase/mediator_application_system.sql` in the Supabase SQL editor before
enabling applications. The service-role key is required at runtime and must
remain server-side.
