import { Router } from 'express';
import { upload } from '../middleware/upload.js';
import { getAppliedConfig } from '../services/config-service.js';
import { routeBatchFromFile, routeSingleParcel, validateBatchFilePayload, validateSingleParcelPayload } from '../services/parcel-service.js';
import type { RoutingConfig } from '../core/config-types.js';

const fallbackConfig = {
  rules: [
    { type: 'approval', when: { field: 'value', operator: '>', value: 1000 }, action: { approval: 'INSURANCE' } },
    { type: 'route', priority: 1, when: { field: 'weight', operator: '<=', value: 1 }, action: { department: 'MAIL' } },
    { type: 'route', priority: 2, when: { field: 'weight', operator: '<=', value: 10 }, action: { department: 'REGULAR' } },
    { type: 'route', priority: 3, when: { field: 'weight', operator: '>', value: 10 }, action: { department: 'HEAVY' } },
    { type: 'route', priority: Number.MAX_SAFE_INTEGER, when: { field: 'weight', operator: '>', value: 0 }, action: { department: 'MANUAL_REVIEW' } }
  ]
} satisfies RoutingConfig;

export const parcelRouter = Router();

parcelRouter.post('/validate/single', async (request, response, next) => {
  try {
    const config = await getAppliedConfig();
    response.json(await validateSingleParcelPayload(request.body, config ?? fallbackConfig));
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

    const config = await getAppliedConfig();
    response.json(await validateBatchFilePayload(request.file, config ?? fallbackConfig));
  } catch (error) {
    next(error);
  }
});

parcelRouter.post('/single', async (request, response, next) => {
  try {
    const config = await getAppliedConfig();
    const sessionId = typeof request.headers['x-session-id'] === 'string' ? request.headers['x-session-id'] : 'backend';

    const { importedBy, ...parcelPayload } = request.body ?? {};
    const result = await routeSingleParcel(parcelPayload, config ?? fallbackConfig, importedBy, sessionId);

    response.json({
      status: result.result.status,
      createdAt: result.createdAt,
      importedBy: result.importedBy,
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
    const sessionId = typeof request.headers['x-session-id'] === 'string' ? request.headers['x-session-id'] : 'backend';

    const result = await routeBatchFromFile(request.file, config ?? fallbackConfig, request.body?.importedBy, sessionId);

    response.json({
      status: result.results.some((entry) => entry.status === 'errored')
        ? 'errored'
        : result.results.some((entry) => entry.status === 'approval pending')
          ? 'approval pending'
          : result.results.some((entry) => entry.status === 'defaulted')
            ? 'defaulted'
            : 'processed',
      batchId: result.batchId,
      createdAt: result.createdAt,
      importedBy: result.importedBy,
      results: result.results
    });
  } catch (error) {
    next(error);
  }
});
