import { Router } from 'express';
import { healthRouter } from './health.route.js';
import { configRouter } from './config.route.js';
import { parcelRouter } from './parcel.route.js';

export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/config', configRouter);
apiRouter.use('/upload', parcelRouter);
