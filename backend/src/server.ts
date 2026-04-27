import { createServer } from 'node:http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';

export async function startServer(port = env.PORT) {
  const app = createApp();
  const server = createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(port, () => {
      logger.info({ port }, 'backend listening');
      resolve();
    });
  });

  return server;
}
