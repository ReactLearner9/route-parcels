import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { logger } from '../utils/logger.js';
import { logExceptionToFile } from '../utils/exception-logger.js';

export const errorHandler: ErrorRequestHandler = (error, request, response, _next) => {
  logger.error(
    {
      error,
      method: request.method,
      path: request.originalUrl,
      ip: request.ip
    },
    'request failed'
  );

  let status = 500;
  const errorMessage = error instanceof Error ? error.message : String(error);
  const multerCode = typeof error === 'object' && error && 'code' in error ? String((error as { code: unknown }).code) : '';

  if (multerCode === 'LIMIT_FILE_SIZE') {
    status = 413;
    void logExceptionToFile(request, error);
    response.status(status).json({
      error: 'Payload Too Large',
      message: 'Uploaded file exceeds the 5 MB size limit.'
    });
    return;
  }

  if (
    error instanceof ZodError ||
    error instanceof SyntaxError ||
    /must contain valid json|batch file must be valid json|only json uploads are allowed/i.test(errorMessage)
  ) {
    status = 400;
    void logExceptionToFile(request, error);
    response.status(status).json({
      error: 'Bad Request',
      message: error instanceof ZodError ? error.issues : error.message
    });
    return;
  }

  if (error instanceof Error && /validated draft/i.test(error.message)) {
    status = 409;
    void logExceptionToFile(request, error);
    response.status(status).json({
      error: 'Conflict',
      message: error.message
    });
    return;
  }

  void logExceptionToFile(request, error);
  response.status(status).json({
    error: 'Internal Server Error',
    message: error instanceof Error ? error.message : 'Unexpected error'
  });
};
