import { z } from 'zod';
import { describeUnsafeOriginPattern } from './corsOrigins.js';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  MONGODB_URI: z.string().min(1),
  MONGODB_DB_NAME: z.string().min(1).default('retentionai'),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),
  CORS_ORIGINS: z.string().min(1),
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(10).max(14).default(12),
  PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().positive().default(30),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  AI_SERVICE_URL: z.string().default('http://127.0.0.1:8000'),
  AI_SERVICE_TOKEN: z.string().default('replace-with-a-service-token'),
  AI_SERVICE_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
  // Upstash Redis (REST API, not a redis:// TCP URL) — backs persistent job
  // state (batch explain/decision jobs) and the distributed AI concurrency
  // lock. Both optional so local dev can run without Redis (see
  // utils/redisClient.js for the in-memory fallback that kicks in when
  // unset); the check below still fails startup on a HALF-set pair, since
  // that's never an intentional configuration — either both are outstanding
  // from a copy/paste (real credentials to add) or one is a typo.
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
});

const PLACEHOLDER_VALUES = new Set([
  'replace-with-at-least-32-random-characters',
  'replace-with-at-least-32-different-random-characters',
  'replace-with-a-service-token',
]);

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  throw new Error(
    `Invalid environment configuration: ${parsedEnv.error.issues.map((issue) => issue.path.join('.')).join(', ')}`,
  );
}

// Half-configured Redis is always a mistake (never a deliberate mode) — fail
// clearly now rather than have redisClient.js silently decide "not
// configured" from the URL while a stray token sits unused, or vice versa.
{
  const hasUrl = !!parsedEnv.data.UPSTASH_REDIS_REST_URL;
  const hasToken = !!parsedEnv.data.UPSTASH_REDIS_REST_TOKEN;
  if (hasUrl !== hasToken) {
    throw new Error(
      `Invalid environment configuration: ${hasUrl ? 'UPSTASH_REDIS_REST_URL is set but UPSTASH_REDIS_REST_TOKEN is missing' : 'UPSTASH_REDIS_REST_TOKEN is set but UPSTASH_REDIS_REST_URL is missing'} — set both or neither.`,
    );
  }
}

// Production-only checks: values that are structurally valid (right type,
// right length) but are still the example placeholder, or otherwise unsafe
// to run a real deployment with. Kept separate from the schema above so
// `development`/`test` can keep using the same example secrets everyone
// already has in their local .env without being blocked.
if (parsedEnv.data.NODE_ENV === 'production') {
  const productionErrors = [];
  if (PLACEHOLDER_VALUES.has(parsedEnv.data.JWT_ACCESS_SECRET)) {
    productionErrors.push('JWT_ACCESS_SECRET is still the example placeholder value.');
  }
  if (PLACEHOLDER_VALUES.has(parsedEnv.data.JWT_REFRESH_SECRET)) {
    productionErrors.push('JWT_REFRESH_SECRET is still the example placeholder value.');
  }
  if (parsedEnv.data.JWT_ACCESS_SECRET === parsedEnv.data.JWT_REFRESH_SECRET) {
    productionErrors.push('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different values.');
  }
  if (PLACEHOLDER_VALUES.has(parsedEnv.data.AI_SERVICE_TOKEN)) {
    productionErrors.push('AI_SERVICE_TOKEN is still the example placeholder value.');
  }
  // A wildcard entry is permitted (deploy-per-URL platforms need it — see
  // config/corsOrigins.js) but only when it pins enough literal text to be
  // unforgeable by a third party. A bare "*", or a whole-domain "*.host"
  // pattern, still refuses to boot.
  for (const origin of parsedEnv.data.CORS_ORIGINS.split(',')) {
    const unsafe = describeUnsafeOriginPattern(origin);
    if (unsafe) {
      productionErrors.push(`CORS_ORIGINS entry ${unsafe}`);
    }
  }
  if (productionErrors.length > 0) {
    throw new Error(`Refusing to start in production with unsafe configuration:\n- ${productionErrors.join('\n- ')}`);
  }
}

export const env = {
  nodeEnv: parsedEnv.data.NODE_ENV,
  port: parsedEnv.data.PORT,
  mongodbUri: parsedEnv.data.MONGODB_URI,
  mongodbDbName: parsedEnv.data.MONGODB_DB_NAME,
  jwtAccessSecret: parsedEnv.data.JWT_ACCESS_SECRET,
  jwtRefreshSecret: parsedEnv.data.JWT_REFRESH_SECRET,
  jwtAccessTtl: parsedEnv.data.JWT_ACCESS_TTL,
  jwtRefreshTtl: parsedEnv.data.JWT_REFRESH_TTL,
  corsOrigins: parsedEnv.data.CORS_ORIGINS.split(',').map((origin) => origin.trim()),
  bcryptSaltRounds: parsedEnv.data.BCRYPT_SALT_ROUNDS,
  passwordResetTtlMinutes: parsedEnv.data.PASSWORD_RESET_TTL_MINUTES,
  logLevel: parsedEnv.data.LOG_LEVEL,
  aiService: {
    url: parsedEnv.data.AI_SERVICE_URL,
    token: parsedEnv.data.AI_SERVICE_TOKEN,
    timeoutMs: parsedEnv.data.AI_SERVICE_TIMEOUT_MS,
  },
  redis: {
    url: parsedEnv.data.UPSTASH_REDIS_REST_URL || null,
    token: parsedEnv.data.UPSTASH_REDIS_REST_TOKEN || null,
    configured: Boolean(parsedEnv.data.UPSTASH_REDIS_REST_URL && parsedEnv.data.UPSTASH_REDIS_REST_TOKEN),
  },
};
