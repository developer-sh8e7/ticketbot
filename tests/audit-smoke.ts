import { existsSync, readFileSync } from 'node:fs';
import { createTicketBot } from '../apps/ticket-bot/src/bot.js';
import { createVoiceRoomsBot } from '../apps/voice-rooms-bot/src/bot.js';
import { createSystemBot } from '../apps/system-bot/src/bot.js';
import { safeOAuthReturnTo } from '../apps/web/src/lib/oauth-return.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const root = process.cwd();
const requiredFiles = [
  'apps/ticket-bot/src/legacy/index.ts',
  'apps/system-bot/src/legacy/index.ts',
  'apps/voice-rooms-bot/src/legacy/services/tempRoomService.ts',
  'apps/voice-rooms-bot/src/legacy/services/voice247Service.ts',
  'db/seed/config_1413059459630104626.json',
  'db/schema/000_complete_schema.sql',
];
for (const file of requiredFiles) assert(existsSync(`${root}/${file}`), `missing ${file}`);

const siteContent = readFileSync(`${root}/apps/web/src/lib/site-content.ts`, 'utf8');
for (const id of ['ticket-bot', 'voice-rooms-bot', 'general-system-bot', 'custom-bot']) assert(siteContent.includes(`id: '${id}'`), `missing product ${id}`);
for (const type of ['ticket', 'voice_rooms', 'general', 'custom']) assert(siteContent.includes(`productType: '${type}'`), `missing product type ${type}`);
const catalog = readFileSync(`${root}/apps/web/src/lib/product-catalog.ts`, 'utf8');
assert(catalog.includes('dbPlanIdFor'), 'catalog must derive database plan ids server-side');
assert(!catalog.includes('temp-rooms-monthly'), 'stale temp-rooms-monthly hardcoded plan found');

const captureRoute = readFileSync(`${root}/apps/web/src/app/api/paypal/capture-order/route.ts`, 'utf8');
assert(captureRoute.includes('plan.dbPlanId'), 'capture route must use selected catalog dbPlanId');
assert(!captureRoute.includes('temp-rooms-monthly'), 'capture route has stale hardcoded temp rooms plan');
assert(captureRoute.includes('requireCustomer'), 'capture route must require login');
assert(captureRoute.includes('guildId'), 'capture route must require guild');

const schemaSql = readFileSync(`${root}/db/schema/000_complete_schema.sql`, 'utf8');
assert(/for update skip locked/i.test(schemaSql), 'claim_token must use FOR UPDATE SKIP LOCKED');
assert(/unique index[\s\S]*claimed_by_instance_id/i.test(schemaSql), 'token unique claimed_by_instance_id index missing');
assert(/bot_token_encrypted/i.test(schemaSql), 'encrypted token column missing');
assert(/provision_instance/i.test(schemaSql), 'provision_instance missing');
assert(/where guild_id = p_guild_id and product_type = p_product_type/i.test(schemaSql), 'renewal lookup must reuse guild/product instance');

const migratedCfg = JSON.parse(readFileSync(`${root}/db/seed/config_1413059459630104626.json`, 'utf8')) as {
  categories?: Array<{ key?: string }>;
  tempRooms?: { defaultRoomName?: string; defaultUserLimit?: number; adminBypass?: boolean };
};
for (const key of ['middleman', 'house_unlock', 'purchase']) {
  assert(migratedCfg.categories?.some((category) => category.key === key), `special guild config missing category ${key}`);
}
assert(migratedCfg.tempRooms?.defaultRoomName === '{username}', 'temp rooms default name must stay {username}');
assert(migratedCfg.tempRooms?.defaultUserLimit === 99, 'temp rooms default user limit must stay 99');
assert(migratedCfg.tempRooms?.adminBypass === true, 'temp rooms admin bypass must stay enabled');

assert(typeof createTicketBot === 'function', 'ticket factory import failed');
assert(typeof createVoiceRoomsBot === 'function', 'voice factory import failed');
assert(typeof createSystemBot === 'function', 'general factory import failed');

const appUrl = 'https://opussolutions.xyz';
assert(safeOAuthReturnTo('/project-request', appUrl) === '/project-request', 'safe OAuth return path rejected');
assert(safeOAuthReturnTo('//evil.example', appUrl) === '/dashboard', 'protocol-relative OAuth redirect accepted');
assert(safeOAuthReturnTo(`/\\evil.example`, appUrl) === '/dashboard', 'backslash OAuth redirect accepted');
assert(safeOAuthReturnTo('https://evil.example', appUrl) === '/dashboard', 'external OAuth redirect accepted');

console.log('audit smoke passed');
