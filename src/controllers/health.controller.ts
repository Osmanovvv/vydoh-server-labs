import type { RequestHandler } from 'express';
import type { HealthService } from '../services/health.service.js';

export function createHealthController(healthService: HealthService): RequestHandler {
  return (_request, response) => {
    response.status(200).json(healthService.getStatus());
  };
}
