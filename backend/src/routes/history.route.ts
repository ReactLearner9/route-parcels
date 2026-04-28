import { Router } from 'express';
import { getParcelHistory, traceParcel } from '../config/parcel-store.js';

export const historyRouter = Router();

historyRouter.get('/', async (_request, response, next) => {
  try {
    response.json(await getParcelHistory());
  } catch (error) {
    next(error);
  }
});

historyRouter.get('/trace/:identifier', async (request, response, next) => {
  try {
    response.json(await traceParcel(request.params.identifier));
  } catch (error) {
    next(error);
  }
});
