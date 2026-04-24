import { z } from 'zod';

const envSchema = z.object({
  // Required API keys
  GEMINI_API_KEY: z.string().min(1, 'GEMINI_API_KEY is required'),
  ELEVENLABS_API_KEY: z.string().min(1, 'ELEVENLABS_API_KEY is required'),
  ELEVENLABS_VOICE_ID: z.string().optional().default('EXAVITQu4vr4xnSDxMaL'),

  // Supabase credentials
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
  SUPABASE_DB_URL: z
    .string()
    .url('SUPABASE_DB_URL must be a valid URL (postgres://…)')
    .startsWith('postgres', 'SUPABASE_DB_URL must be a postgres:// or postgresql:// URL'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),
  SUPABASE_ANON_KEY: z.string().min(1, 'SUPABASE_ANON_KEY is required'),

  // Gemini model
  GEMINI_MODEL: z.string().optional().default('gemini-2.5-pro'),

  // Auth
  DEMO_USER_BEARER_TOKEN: z.string().min(1, 'DEMO_USER_BEARER_TOKEN is required'),

  // Server config
  PORT: z
    .string()
    .optional()
    .default('3000')
    .transform((v) => parseInt(v, 10))
    .refine((v) => !Number.isNaN(v) && v > 0 && v < 65536, 'PORT must be a valid port number'),
  NODE_ENV: z.enum(['development', 'production', 'test', 'staging']).optional().default('development'),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Environment validation failed:\n${issues}`);
  }
  return result.data;
}

export const env = loadEnv();
