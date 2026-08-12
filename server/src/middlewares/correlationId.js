import { randomUUID } from 'crypto';

/**
 * Express middleware to manage request correlation IDs.
 * Accepts incoming 'x-correlation-id' or generates a secure UUID v4.
 * Attaches correlationId to req and sets response header 'X-Correlation-ID'.
 */
export function correlationIdMiddleware(req, res, next) {
  const incomingCorrelationId = req.headers['x-correlation-id'] || req.headers['x-request-id'];
  const correlationId =
    typeof incomingCorrelationId === 'string' && incomingCorrelationId.trim().length > 0
      ? incomingCorrelationId.trim().slice(0, 128)
      : randomUUID();

  req.correlationId = correlationId;
  res.setHeader('X-Correlation-ID', correlationId);

  next();
}

export const correlationId = correlationIdMiddleware;
