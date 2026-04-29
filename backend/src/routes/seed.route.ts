import { Router } from 'express';
import { resetAndSeedBackend, seedConfigDataOnly, seedParcelAndBatchDataOnly } from '../services/seed-service.js';

export const seedRouter = Router();

seedRouter.post('/', async (request, response, next) => {
  try {
    const action = request.body?.action ?? 'all';
    if (action === 'parcels' || action === 'batch') {
      response.json(await seedParcelAndBatchDataOnly());
      return;
    }
    if (action === 'config') {
      response.json(await seedConfigDataOnly());
      return;
    }
    response.json(await resetAndSeedBackend());
  } catch (error) {
    next(error);
  }
});
