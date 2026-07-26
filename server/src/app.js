import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { healthRouter } from './routes/healthRoutes.js';

export const app = express();

app.use(helmet());
app.use(cors({ origin: env.corsOrigins }));
app.use(express.json());
app.use(healthRouter);
