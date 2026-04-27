import type { ErrorRequestHandler } from 'express';
import { logger } from '../utils/logger.js';

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  logger.error({ error }, 'request failed');

  response.status(500).json({
    error: 'Internal Server Error'
  });
};
