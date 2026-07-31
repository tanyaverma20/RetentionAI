/**
 * @file logger.js
 * @description Structured logging — Sprint 10, Part 5.
 *
 * JSON logs in production (machine-parseable for log aggregation), readable
 * colorized text in development. Every log call site attaches structured
 * fields (requestId, userId, category, ...) rather than interpolating them
 * into a message string, so they stay queryable once ingested.
 *
 * File output rotates daily and is capped, so a long-running production
 * process can't fill the disk — the same failure mode that twice took down
 * MongoDB in this project's own history (see docs/ dev notes on mongo-mem
 * cleanup) is exactly what rotation exists to prevent for the app's own logs.
 */

import path from 'path';
import { fileURLToPath } from 'url';
import winston from 'winston';
import 'winston-daily-rotate-file';
import { env } from '../config/env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_DIR = process.env.LOG_DIR || path.resolve(__dirname, '../../logs');

const isProduction = env.nodeEnv === 'production';

const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
);

const devFormat = winston.format.combine(
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const rest = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} ${level}: ${message}${rest}`;
  }),
);

const transports = [
  new winston.transports.Console({ format: isProduction ? jsonFormat : devFormat }),
  new winston.transports.DailyRotateFile({
    dirname: LOG_DIR,
    filename: 'combined-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '14d',
    format: jsonFormat,
  }),
  new winston.transports.DailyRotateFile({
    dirname: LOG_DIR,
    filename: 'error-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '30d',
    level: 'error',
    format: jsonFormat,
  }),
];

export const logger = winston.createLogger({
  level: env.logLevel,
  defaultMeta: { service: 'retentionai-server' },
  transports,
});

/** Per-request logger carrying requestId (and, once authenticated, userId/role) on every line. */
export function requestLogger(request) {
  return logger.child({
    requestId: request.requestId,
    userId: request.auth?.userId,
    role: request.auth?.role,
  });
}
