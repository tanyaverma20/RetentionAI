import { rateLimit } from 'express-rate-limit';
import { getRedisClient, isRedisConfigured } from '../utils/redisClient.js';
import { logger } from '../utils/logger.js';
import { sendError } from '../utils/response.js';

/**
 * Upstash Redis store adapter for express-rate-limit.
 * Uses REST API stateless fetch calls via @upstash/redis.
 */
class UpstashRedisStore {
  constructor(prefix = 'rl:') {
    this.prefix = prefix;
  }

  init(options) {
    this.windowMs = options.windowMs;
  }

  async increment(key) {
    if (!isRedisConfigured()) return undefined;
    try {
      const redis = getRedisClient();
      const redisKey = `${this.prefix}${key}`;
      const totalHits = await redis.incr(redisKey);
      if (totalHits === 1) {
        await redis.pexpire(redisKey, this.windowMs);
      }
      const pttl = await redis.pttl(redisKey);
      const resetTime = new Date(Date.now() + (pttl > 0 ? pttl : this.windowMs));
      return { totalHits, resetTime };
    } catch (err) {
      logger.warn('redis_rate_limit_error', { error: err.message });
      return undefined;
    }
  }

  async decrement(key) {
    if (!isRedisConfigured()) return;
    try {
      const redis = getRedisClient();
      const redisKey = `${this.prefix}${key}`;
      const current = await redis.decr(redisKey);
      if (current <= 0) {
        await redis.del(redisKey);
      }
    } catch (err) {
      logger.warn('redis_rate_limit_decr_error', { error: err.message });
    }
  }

  async resetKey(key) {
    if (!isRedisConfigured()) return;
    try {
      const redis = getRedisClient();
      await redis.del(`${this.prefix}${key}`);
    } catch (err) {
      logger.warn('redis_rate_limit_reset_error', { error: err.message });
    }
  }
}

/**
 * Helper to build standard rate limiters with consistent headers, responses, and store.
 */
function createRateLimit({ windowMs, limit, keyGenerator, skipSuccessfulRequests = false, prefix = 'rl:' }) {
  const store = isRedisConfigured() ? new UpstashRedisStore(prefix) : undefined;
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator,
    skipSuccessfulRequests,
    ...(store ? { store } : {}),
    handler: (request, response) =>
      sendError(
        response,
        429,
        'RATE_LIMITED',
        'Too many requests. Please try again later.',
        request.requestId,
      ),
  });
}

export const loginRateLimit = createRateLimit({
  windowMs: 60_000,
  limit: 15,
  skipSuccessfulRequests: true,
  prefix: 'rl:login:',
  keyGenerator: (request) => `${request.ip}:${(request.body?.email ?? '').trim().toLowerCase()}`,
});

export const refreshRateLimit = createRateLimit({
  windowMs: 60_000,
  limit: 20,
  prefix: 'rl:refresh:',
  keyGenerator: (request) => request.ip,
});

export const forgotPasswordRateLimit = createRateLimit({
  windowMs: 60 * 60_000,
  limit: 5,
  prefix: 'rl:forgot:',
  keyGenerator: (request) => `${request.ip}:${(request.body?.email ?? '').trim().toLowerCase()}`,
});

export const resetPasswordRateLimit = createRateLimit({
  windowMs: 60 * 60_000,
  limit: 5,
  prefix: 'rl:reset:',
  keyGenerator: (request) => `${request.ip}:${request.body?.token ?? ''}`,
});

export const passwordChangeRateLimit = createRateLimit({
  windowMs: 60 * 60_000,
  limit: 5,
  prefix: 'rl:pwdchange:',
  keyGenerator: (request) => request.auth?.userId ?? request.ip,
});

export const signupRateLimit = createRateLimit({
  windowMs: 60 * 60_000,
  limit: 10,
  prefix: 'rl:signup:',
  keyGenerator: (request) => request.ip,
});
