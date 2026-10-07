import express, { type Express } from 'express';
import type { AppConfig } from './config/env.js';
import { createHealthController } from './controllers/health.controller.js';
import { errorHandler } from './middleware/error-handler.js';
import { createHealthService, type HealthService } from './services/health.service.js';

export interface AppDependencies {
  config: AppConfig;
  healthService?: HealthService;
}

export function createApp({ config, healthService = createHealthService(config) }: AppDependencies): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  const healthController = createHealthController(healthService);
  app.get('/api/v1/health', healthController);
  app.get('/health', healthController);

  app.use(errorHandler);

  return app;
}
