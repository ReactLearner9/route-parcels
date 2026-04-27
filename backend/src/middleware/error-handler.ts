import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { logger } from '../utils/logger.js';

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  logger.error({ error }, 'request failed');

  if (
    error instanceof ZodError ||
    error instanceof SyntaxError ||
    (error instanceof Error && /must contain valid json/i.test(error.message))
  ) {
    response.status(400).json({
      error: 'Bad Request',
      message: error instanceof ZodError ? error.issues : error.message
    });
    return;
  }

  if (error instanceof Error && /validated draft/i.test(error.message)) {
    response.status(409).json({
      error: 'Conflict',
      message: error.message
    });
    return;
  }

  response.status(500).json({
    error: 'Internal Server Error',
    message: error instanceof Error ? error.message : 'Unexpected error'
  });
};
