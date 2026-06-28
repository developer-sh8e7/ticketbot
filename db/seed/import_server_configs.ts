/**
 * يستورد إعدادات السيرفر الخاص (1413059459630104626) إلى جدول server_configs.
 * هذا السيرفر زبون عادي يمرّ بنفس النظام، لكن له إعدادات تكتات خاصة محفوظة مسبقاً.
 * تشغيل: tsx db/seed/import_server_configs.ts
 *
 * يحافظ على كل ما في الـ config الأصلي ويربطه بالمنتج 'ticket'.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createSupabaseClient, loadEnv, createLogger } from '@opus/core';

const log = createLogger('seed');
const __dirname = dirname(fileURLToPath(import.meta.url));

const SPECIAL = [
  { guildId: '1413059459630104626', productType: 'ticket', file: 'config_1413059459630104626.json' },
] as const;

async function main() {
  const env = loadEnv();
  const supabase = createSupabaseClient(env);

  for (const entry of SPECIAL) {
    const raw = readFileSync(join(__dirname, entry.file), 'utf-8');
    const config = JSON.parse(raw);

    const { error } = await supabase
      .from('server_configs')
      .upsert(
        {
          guild_id: entry.guildId,
          product_type: entry.productType,
          config_data: config,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'guild_id,product_type' },
      );

    if (error) throw new Error(`فشل استيراد ${entry.file}: ${error.message}`);
    log.info(`✅ استورد إعدادات ${entry.guildId} (${entry.productType})`);
  }

  log.info('انتهى الاستيراد.');
}

main().catch((e) => {
  log.error('فشل الاستيراد', e instanceof Error ? e.message : e);
  process.exit(1);
});
