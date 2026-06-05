import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  DISCORD_TOKEN: z.string().min(1),
  DISCORD_CLIENT_ID: z.string().min(1),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  CONFIG_PATH: z.string().min(1).default('./config/config.json'),
  GEMINI_API_KEY: z.string().optional(),
  AI_PROVIDER: z.enum(['gemini', 'openai']).default('openai'),
  AI_BASE_URL: z.string().default('https://opencode.ai/zen/v1'),
  AI_MODEL: z.string().default('deepseek-v4-flash-free'),
  DISCORD_CLIENT_SECRET: z.string().optional(),
  DISCORD_REDIRECT_URI: z.string().url().optional(),
  STAFF_ROLE_ID: z.string().optional(),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_WHATSAPP_NUMBER: z.string().optional(),
  TWILIO_CONTENT_SID: z.string().optional(),
  WEBSITE_URL: z.string().url().optional(),
  VERIFICATION_WEBHOOK_URL: z.string().url().optional(),
  SESSION_SECRET: z.string().min(64).optional(),
  JWT_SECRET: z.string().min(64).optional(),
  WEB_PORT: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

function optionalEnv(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function loadEnv(): Env {
  return envSchema.parse({
    DISCORD_TOKEN: process.env.DISCORD_TOKEN,
    DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    CONFIG_PATH: process.env.CONFIG_PATH ?? './config/config.json',
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    AI_PROVIDER: (process.env.AI_PROVIDER || 'openai') as 'gemini' | 'openai',
    AI_BASE_URL: process.env.AI_BASE_URL ?? 'https://opencode.ai/zen/v1',
    AI_MODEL: process.env.AI_MODEL ?? 'deepseek-v4-flash-free',
    DISCORD_CLIENT_SECRET: optionalEnv(process.env.DISCORD_CLIENT_SECRET),
    DISCORD_REDIRECT_URI: optionalEnv(process.env.DISCORD_REDIRECT_URI),
    STAFF_ROLE_ID: optionalEnv(process.env.STAFF_ROLE_ID),
    TWILIO_ACCOUNT_SID: optionalEnv(process.env.TWILIO_ACCOUNT_SID),
    TWILIO_AUTH_TOKEN: optionalEnv(process.env.TWILIO_AUTH_TOKEN),
    TWILIO_WHATSAPP_NUMBER: optionalEnv(process.env.TWILIO_WHATSAPP_NUMBER),
    TWILIO_CONTENT_SID: optionalEnv(process.env.TWILIO_CONTENT_SID),
    WEBSITE_URL: optionalEnv(process.env.WEBSITE_URL),
    VERIFICATION_WEBHOOK_URL: optionalEnv(process.env.VERIFICATION_WEBHOOK_URL),
    SESSION_SECRET: optionalEnv(process.env.SESSION_SECRET),
    JWT_SECRET: optionalEnv(process.env.JWT_SECRET),
    WEB_PORT: optionalEnv(process.env.WEB_PORT),
  });
}
