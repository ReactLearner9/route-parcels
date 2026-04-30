import express from 'express';
import { apiRouter } from './routes/index.js';
import { errorHandler } from './middleware/error-handler.js';
import { notFoundHandler } from './middleware/not-found.js';
import { securityHeaders } from './middleware/security-headers.js';
import { corsGuard } from './middleware/cors.js';
import { apiRateLimit } from './middleware/rate-limit.js';
import { inputHardening } from './middleware/input-hardening.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(securityHeaders);
  app.use(corsGuard);
  app.use(apiRateLimit);
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(inputHardening);
  app.use('/api', apiRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
