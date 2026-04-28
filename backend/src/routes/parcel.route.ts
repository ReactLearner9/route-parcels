import { Router } from 'express';
import { upload } from '../middleware/upload.js';
import { getAppliedConfig } from '../services/config-service.js';
import { routeBatchFromFile, routeSingleParcel, validateBatchFilePayload, validateSingleParcelPayload } from '../services/parcel-service.js';

export const parcelRouter = Router();

parcelRouter.post('/validate/single', async (request, response, next) => {
  try {
    await validateSingleParcelPayload(request.body);
    response.json({ valid: true });
  } catch (error) {
    next(error);
  }
});

parcelRouter.post('/validate/batch', upload.single('batchFile'), async (request, response, next) => {
  try {
    if (!request.file) {
      response.status(400).json({ error: 'batchFile is required' });
      return;
    }

    await validateBatchFilePayload(request.file);
    response.json({ valid: true });
  } catch (error) {
    next(error);
  }
});

parcelRouter.post('/single', async (request, response, next) => {
  try {
    const config = await getAppliedConfig();

    if (!config) {
      response.status(409).json({ error: 'No routing config has been applied' });
      return;
    }

    const result = await routeSingleParcel(request.body, config);

    response.status(201).json({
      fileId: result.fileId,
      result: result.result
    });
  } catch (error) {
    next(error);
  }
});

parcelRouter.post('/batch', upload.single('batchFile'), async (request, response, next) => {
  try {
    if (!request.file) {
      response.status(400).json({ error: 'batchFile is required' });
      return;
    }

    const config = await getAppliedConfig();

    if (!config) {
      response.status(409).json({ error: 'No routing config has been applied' });
      return;
    }

    const result = await routeBatchFromFile(request.file, config);

    response.status(201).json({
      fileId: result.fileId,
      results: result.results
    });
  } catch (error) {
    next(error);
  }
});
