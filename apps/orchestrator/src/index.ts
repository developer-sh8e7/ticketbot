import express, { type Request, type Response } from 'express';
import { createSupabaseClient, createLogger, isProductType } from '@opus/core';
import { loadOrchestratorEnv } from './env.js';
import { TokenPoolRepository } from './tokenPool.js';
import { InstanceManager } from './manager.js';
import { ProvisioningService, AccountNotLinkedError, NoTokenAvailableError } from './provisioning.js';

const log = createLogger('orchestrator');

async function main() {
  const env = loadOrchestratorEnv();
  const supabase = createSupabaseClient(env);

  const tokenPool = new TokenPoolRepository(supabase, env.TOKEN_ENCRYPTION_KEY);
  const manager = new InstanceManager(supabase, tokenPool, env.TOKEN_ENCRYPTION_KEY);
  const provisioning = new ProvisioningService(supabase);

  await manager.init();

  const app = express();
  app.use(express.json());

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ ok: true, running: manager.runningCount });
  });

  /**
   * نقطة التفعيل. يستدعيها الموقع بعد تأكيد PayPal للدفع.
   * محمية بسرّ مشترك (MANAGER_SYNC_SECRET) للتحقق من المصدر.
   * في الإنتاج: تحقّق إضافي من توقيع PayPal webhook (PAYPAL_WEBHOOK_ID).
   */
  app.post('/internal/provision', async (req: Request, res: Response) => {
    if (req.header('x-opus-secret') !== env.MANAGER_SYNC_SECRET) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const { discordUserId, guildId, guildName, productType, planName, durationDays, externalRef } = req.body ?? {};
    if (!discordUserId || !guildId || !isProductType(productType)) {
      return res.status(400).json({ error: 'missing or invalid fields' });
    }

    try {
      const instance = await provisioning.provision({
        discordUserId, guildId, guildName, productType, planName, durationDays, externalRef,
      });
      await manager.sync(); // تشغيل فوري دون انتظار الدورة الدورية
      return res.json({ ok: true, instanceId: instance.id, expiresAt: instance.expires_at });
    } catch (e) {
      if (e instanceof AccountNotLinkedError) return res.status(409).json({ error: 'account_not_linked' });
      if (e instanceof NoTokenAvailableError) return res.status(503).json({ error: 'no_token_available' });
      log.error('provision failed', e instanceof Error ? e.message : e);
      return res.status(500).json({ error: 'internal_error' });
    }
  });

  app.listen(env.WEB_PORT, () => log.info(`🌐 Orchestrator webhook على المنفذ ${env.WEB_PORT}`));

  const shutdown = async () => { await manager.destroy(); process.exit(0); };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  log.error('فشل إقلاع الأوركستريتر', err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
