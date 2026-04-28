import { Router } from 'express';
import { resetAndSeedBackend } from '../services/seed-service.js';

export const seedRouter = Router();

seedRouter.post('/', async (_request, response, next) => {
  try {
    response.json(await resetAndSeedBackend());
  } catch (error) {
    next(error);
  }
});
