import { Router } from 'express';
import { megaUpload } from '../middleware/upload.js';
import { getParcelCounts, listParcelRecords } from '../config/parcel-store.js';
import { getAppliedConfig } from '../services/config-service.js';
import { processMegaBatchFile } from '../services/parcel-service.js';
import type { RoutingConfig } from '../core/config-types.js';

export const parcelsRouter = Router();
const megaImportApiKey = 'mega-import-demo-key';
const fallbackConfig = {
  rules: [
    { type: 'approval', when: { field: 'value', operator: '>', value: 1000 }, action: { approval: 'INSURANCE' } },
    { type: 'route', priority: 1, when: { field: 'weight', operator: '<=', value: 1 }, action: { department: 'MAIL' } },
    { type: 'route', priority: 2, when: { field: 'weight', operator: '<=', value: 10 }, action: { department: 'REGULAR' } },
    { type: 'route', priority: 3, when: { field: 'weight', operator: '>', value: 10 }, action: { department: 'HEAVY' } },
    { type: 'route', priority: Number.MAX_SAFE_INTEGER, when: { field: 'weight', operator: '>', value: 0 }, action: { department: 'MANUAL_REVIEW' } }
  ]
} satisfies RoutingConfig;

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

parcelsRouter.post('/mega', megaUpload.single('batchFile'), async (request, response, next) => {
  try {
    if (!request.file) {
      response.status(400).json({ error: 'batchFile is required' });
      return;
    }

    const apiKeyHeader = request.headers['x-api-key'];
    if (apiKeyHeader !== megaImportApiKey) {
      response.status(403).json({ error: 'Forbidden', message: 'Invalid API key' });
      return;
    }

    const config = await getAppliedConfig();
    const sessionId = typeof request.headers['x-session-id'] === 'string' ? request.headers['x-session-id'] : 'backend';
    const outcome = await processMegaBatchFile(
      request.file,
      config ?? fallbackConfig,
      request.body?.importedBy,
      sessionId
    );

    response.setHeader('content-type', 'text/csv; charset=utf-8');
    response.setHeader('content-disposition', `attachment; filename="${outcome.fileName}"`);
    response.setHeader('x-mega-status', outcome.status);
    response.setHeader('x-record-count', String(outcome.recordCount));
    response.setHeader('x-validation-issue-count', String(outcome.validationIssueCount));
    if (outcome.status === 'processed') {
      response.setHeader('x-batch-id', outcome.batchId);
    }

    response.status(outcome.status === 'processed' ? 200 : 422).send(outcome.fileContent);
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
