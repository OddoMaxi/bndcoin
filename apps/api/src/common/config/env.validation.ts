import { z } from 'zod';

const bool = (def: boolean) =>
  z
    .enum(['true', 'false'])
    .default(def ? 'true' : 'false')
    .transform((v) => v === 'true');

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    API_PORT: z.coerce.number().int().positive().default(3001),
    APP_URL: z.string().url().default('http://localhost:3000'),

    DATABASE_URL: z.string().url(),
    REDIS_URL: z.string().url(),

    JWT_ACCESS_SECRET: z.string().min(16),
    JWT_REFRESH_SECRET: z.string().min(16),
    JWT_ACCESS_TTL: z.coerce.number().int().positive().default(900),
    JWT_REFRESH_TTL: z.coerce.number().int().positive().default(604_800),

    QR_SIGNING_SECRET: z.string().min(16).default('dev-qr-signing-secret-change-me'),

    // Master safety switches — keep everything mock/false until real creds/hardware.
    REAL_MONEY_MODE: bool(false),
    REAL_CRYPTO_MODE: bool(false),
    ORANGE_MODE: z.enum(['mock', 'modem']).default('mock'),
    OTP_MODE: z.enum(['mock', 'live']).default('mock'),
    BLOCKCHAIN_PROVIDER: z.enum(['mock', 'live']).default('mock'),

    MOCK_PROVIDERS_ENABLED: bool(true),

    DEFAULT_QUOTE_TTL: z.coerce.number().int().positive().default(120),
    DEFAULT_BUY_SPREAD_BPS: z.coerce.number().int().nonnegative().default(400),
    DEFAULT_SELL_SPREAD_BPS: z.coerce.number().int().nonnegative().default(400),
    PAYMENT_WINDOW_SECONDS: z.coerce.number().int().positive().default(900),
    QUOTE_SWEEP_INTERVAL_SECONDS: z.coerce.number().int().positive().default(30),
    CRYPTO_REQUIRED_CONFIRMATIONS: z.coerce.number().int().positive().default(3),

    RATE_LIMIT_TTL: z.coerce.number().int().positive().default(60),
    RATE_LIMIT_LIMIT: z.coerce.number().int().positive().default(200),

    CORS_ORIGIN: z.string().default('http://localhost:3000'),
  })
  .superRefine((env, ctx) => {
    if (env.REAL_MONEY_MODE && env.ORANGE_MODE !== 'modem') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'REAL_MONEY_MODE=true requires ORANGE_MODE=modem with configured hardware',
      });
    }
    if (env.REAL_MONEY_MODE && env.OTP_MODE !== 'live') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'REAL_MONEY_MODE=true requires OTP_MODE=live',
      });
    }
    if (env.REAL_CRYPTO_MODE && env.BLOCKCHAIN_PROVIDER !== 'live') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'REAL_CRYPTO_MODE=true requires BLOCKCHAIN_PROVIDER=live',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}
