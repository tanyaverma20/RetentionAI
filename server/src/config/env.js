import 'dotenv/config';

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 5000),
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173').split(','),
};
