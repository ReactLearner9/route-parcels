import { Router } from 'express';
import { healthRouter } from './health.route.js';
import { configRouter } from './config.route.js';
import { parcelRouter } from './parcel.route.js';
import { authRouter } from './auth.route.js';
import { parcelsRouter } from './parcels.route.js';
import { seedRouter } from './seed.route.js';
import { logsRouter } from './logs.route.js';
import { alertsRouter } from './alerts.route.js';

export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/config', configRouter);
apiRouter.use('/upload', parcelRouter);
apiRouter.use('/parcels', parcelsRouter);
apiRouter.use('/seed', seedRouter);
apiRouter.use('/logs', logsRouter);
apiRouter.use('/alerts', alertsRouter);
