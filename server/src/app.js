import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';
import { requestId } from './middlewares/requestId.js';
import { sanitizeInput } from './middlewares/sanitizeInput.js';
import { analyticsRouter } from './routes/analyticsRoutes.js';
import { authRouter } from './routes/authRoutes.js';
import { departmentRouter } from './routes/departmentRoutes.js';
import { employeeRouter } from './routes/employeeRoutes.js';
import { healthRouter } from './routes/healthRoutes.js';
import { userRouter } from './routes/userRoutes.js';
import hrRouter from './routes/hrRoutes.js';

export const app = express();

app.use(requestId);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || env.corsOrigins.includes(origin)) return callback(null, true);
      return callback(new Error('Origin is not allowed by CORS.'));
    },
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Request-Id'],
  }),
);
app.use(express.json({ limit: '1mb' }));
app.use(sanitizeInput);

// Static file serving for uploads (profile pictures, etc.)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use('/uploads', express.static(path.resolve(__dirname, '../../uploads')));

app.use(healthRouter);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/departments', departmentRouter);
app.use('/api/v1/employees', employeeRouter);
app.use('/api/v1/analytics', analyticsRouter);
app.use('/api/v1/hr', hrRouter);
app.use(notFoundHandler);
app.use(errorHandler);
