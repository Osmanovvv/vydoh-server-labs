import type { AppConfig } from '../config/env.js';

export interface HealthResponse {
  status: 'pass';
  app_name: string;
  version: string;
  environment: string;
  uptime: number;
}

export interface HealthService {
  getStatus(): HealthResponse;
}

type Clock = () => bigint;

export function createHealthService(config: AppConfig, clock: Clock = process.hrtime.bigint): HealthService {
  const startedAt = clock();

  return {
    getStatus(): HealthResponse {
      const elapsedSeconds = Number(clock() - startedAt) / 1_000_000_000;

      return {
        status: 'pass',
        app_name: config.appName,
        version: config.version,
        environment: config.environment,
        uptime: Number(Math.max(0, elapsedSeconds).toFixed(3)),
      };
    },
  };
}
