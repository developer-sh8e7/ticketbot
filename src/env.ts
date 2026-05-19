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
});

export type Env = z.infer<typeof envSchema>;

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
  });
}
