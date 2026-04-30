import { Router } from 'express';
import { getParcelCounts, listParcelRecords } from '../config/parcel-store.js';

export const parcelsRouter = Router();

parcelsRouter.get('/', async (request, response, next) => {
  try {
    const parcelId = typeof request.query.parcelId === 'string' ? request.query.parcelId : undefined;
    const batchId = typeof request.query.batchId === 'string' ? request.query.batchId : undefined;
    const importedBy = typeof request.query.importedBy === 'string' ? request.query.importedBy : undefined;
    response.json({
      records: await listParcelRecords({ parcelId, batchId, importedBy })
    });
  } catch (error) {
    next(error);
  }
});

parcelsRouter.get('/count', async (_request, response, next) => {
  try {
    response.json(await getParcelCounts());
  } catch (error) {
    next(error);
  }
});
