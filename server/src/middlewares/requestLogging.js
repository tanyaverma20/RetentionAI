import { requestLogger } from '../utils/logger.js';

/** Logs one line per completed request — method, path, status, duration, requestId, and (once authenticated) the caller. */
export function requestLoggingMiddleware(request, response, next) {
  const start = process.hrtime.bigint();
  response.on('finish', () => {
    const durationMs = Math.round(Number(process.hrtime.bigint() - start) / 1e6);
    const level = response.statusCode >= 500 ? 'error' : response.statusCode >= 400 ? 'warn' : 'info';
    requestLogger(request).log(level, 'http_request', {
      method: request.method,
      path: request.path,
      statusCode: response.statusCode,
      durationMs,
    });
  });
  next();
}
