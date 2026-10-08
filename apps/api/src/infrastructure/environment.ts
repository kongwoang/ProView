import { config } from 'dotenv';
import { resolve } from 'node:path';
import { z } from 'zod';

const booleanString = z.enum(['true', 'false']).transform((value) => value === 'true');

export const environmentSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    APP_ENV: z.enum(['local', 'test', 'production']).default('local'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3001),
    BIND_ADDRESS: z.enum(['0.0.0.0', '127.0.0.1', '::', '::1']).default('0.0.0.0'),
    DATABASE_URL: z
      .url()
      .refine((value) => /^postgres(?:ql)?:/.test(value), 'PostgreSQL URL required'),
    JWT_ACCESS_SECRET: z.string().min(32),
    ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(30).default(7),
    FRONTEND_URL: z.url().default('http://localhost:3000'),
    COOKIE_SECURE: booleanString.default(false),
    TRUST_PROXY: booleanString.default(false),
    ENABLE_API_DOCS: booleanString.default(false),
    SEED_DEMO: booleanString.default(false),
    STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
    STORAGE_LOCAL_PATH: z.string().min(1).default('../../.data/files'),
    MAX_UPLOAD_BYTES: z.coerce
      .number()
      .int()
      .positive()
      .max(100 * 1024 * 1024)
      .default(20 * 1024 * 1024),
    S3_ENDPOINT: z.url().optional(),
    S3_REGION: z.string().default('us-east-1'),
    S3_BUCKET: z.string().min(3).default('proview-private'),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
    S3_FORCE_PATH_STYLE: booleanString.default(true),
  })
  .superRefine((env, context) => {
    if (env.APP_ENV === 'production') {
      if (!env.COOKIE_SECURE)
        context.addIssue({
          code: 'custom',
          path: ['COOKIE_SECURE'],
          message: 'Production requires secure cookies',
        });
      if (!env.FRONTEND_URL.startsWith('https://'))
        context.addIssue({
          code: 'custom',
          path: ['FRONTEND_URL'],
          message: 'Production requires HTTPS',
        });
      if (env.SEED_DEMO)
        context.addIssue({
          code: 'custom',
          path: ['SEED_DEMO'],
          message: 'Demo seed forbidden in production',
        });
      if (/local|example|change.me/i.test(env.JWT_ACCESS_SECRET))
        context.addIssue({
          code: 'custom',
          path: ['JWT_ACCESS_SECRET'],
          message: 'Replace example secret in production',
        });
    }
    if (env.STORAGE_DRIVER === 's3' && (!env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY)) {
      context.addIssue({
        code: 'custom',
        path: ['S3_ACCESS_KEY_ID'],
        message: 'S3 credentials required for S3 storage',
      });
    }
  });

export type Environment = z.infer<typeof environmentSchema>;
let cached: Environment | undefined;

export function loadEnvironment(): Environment {
  if (cached) return cached;
  config({
    path: [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env')],
    quiet: true,
  });
  const parsed = environmentSchema.safeParse(process.env);
  if (!parsed.success) {
    // Report field names and validation rules only, never supplied secret values.
    throw new Error(
      `Invalid configuration: ${parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`,
    );
  }
  cached = parsed.data;
  return cached;
}
