import { coreEnvSchema, loadEnv } from '@opus/core';
import { z } from 'zod';

export const orchestratorEnvSchema = coreEnvSchema.extend({
  OPUS_CONTROL_BOT_TOKEN: z.string().optional(),
  TRIAL_MANAGER_ID: z.string().default('1029665419788832800'),
  OPUS_NOTIFY_CHANNEL_ID: z.string().default('1482267609062703104'),
  WEB_PORT: z.coerce.number().default(8787),
  MANAGER_SYNC_SECRET: z.string().min(1),

  PAYPAL_ENV: z.enum(['sandbox', 'live']).default('live'),
  PAYPAL_CLIENT_ID: z.string().optional(),
  PAYPAL_CLIENT_SECRET: z.string().optional(),
  PAYPAL_WEBHOOK_ID: z.string().optional(),
});

export type OrchestratorEnv = z.infer<typeof orchestratorEnvSchema>;

export function loadOrchestratorEnv(): OrchestratorEnv {
  return loadEnv(orchestratorEnvSchema);
}
