import { randomUUID } from 'crypto';

/**
 * Middleware to ensure every HTTP request has a correlation ID.
 * Reads 'x-correlation-id' header or generates a new UUID v4.
 * Attaches correlationId to req and sets response header.
 */
export function correlationIdMiddleware(req, res, next) {
  const incomingCorrelationId = req.headers['x-correlation-id'];
  const correlationId =
    typeof incomingCorrelationId === 'string' && incomingCorrelationId.trim().length > 0
      ? incomingCorrelationId.trim().slice(0, 128)
      : randomUUID();

  req.correlationId = correlationId;
  res.setHeader('X-Correlation-ID', correlationId);

  next();
}
