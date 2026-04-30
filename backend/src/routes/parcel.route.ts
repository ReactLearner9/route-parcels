import { Router } from 'express';
import { upload } from '../middleware/upload.js';
import { getAppliedConfig } from '../services/config-service.js';
import { routeBatchFromFile, routeSingleParcel, validateBatchFilePayload, validateSingleParcelPayload } from '../services/parcel-service.js';
import {
  recordBatchImportFailure,
  recordSingleImportFailure,
  recordValidationFailedUpload
} from '../services/alert-service.js';
import type { RoutingConfig } from '../core/config-types.js';
import { logAuditEvent } from '../utils/audit-logger.js';

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

function readSessionId(headers: Record<string, unknown>) {
  return typeof headers['x-session-id'] === 'string' ? headers['x-session-id'] : 'backend';
}

function normalizeActor(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : 'system';
}

function countBatchParcels(file: Express.Multer.File) {
  try {
    const parsed = JSON.parse(file.buffer.toString('utf8')) as { parcels?: unknown[] };
    return Array.isArray(parsed.parcels) ? parsed.parcels.length : 0;
  } catch {
    return 0;
  }
}

parcelRouter.post('/validate/single', async (request, response, next) => {
  try {
    const config = await getAppliedConfig();
    const sessionId = readSessionId(request.headers as Record<string, unknown>);
    const actor = normalizeActor((request.body as { importedBy?: unknown } | undefined)?.importedBy);
    const report = await validateSingleParcelPayload(request.body, config ?? fallbackConfig);
    await logAuditEvent({
      user: actor,
      sessionId,
      screen: 'Import Single',
      functionality: 'single_validate',
      feature: 'single-import',
      status: report.valid ? 'passed' : 'failed',
      details: { count: 1, failedCount: report.valid ? 0 : 1, passedCount: report.valid ? 1 : 0 }
    });
    response.json(report);
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
    const sessionId = readSessionId(request.headers as Record<string, unknown>);
    const actor = normalizeActor(request.body?.importedBy);
    const report = await validateBatchFilePayload(request.file, config ?? fallbackConfig);
    const recordCount = countBatchParcels(request.file);
    const failedCount = report.valid ? 0 : new Set(report.issues.map((issue) => issue.rowNo)).size;
    await logAuditEvent({
      user: actor,
      sessionId,
      screen: 'Import Batch',
      functionality: 'batch_validate',
      feature: 'batch-import',
      status: report.valid ? 'passed' : 'failed',
      details: { count: recordCount, failedCount, passedCount: Math.max(0, recordCount - failedCount) }
    });
    if (!report.valid) {
      await recordValidationFailedUpload({ source: 'batch', issueCount: report.issues.length });
    }
    response.json(report);
  } catch (error) {
    next(error);
  }
});

parcelRouter.post('/single', async (request, response, next) => {
  try {
    const config = await getAppliedConfig();
    const sessionId = readSessionId(request.headers as Record<string, unknown>);

    const { importedBy, ...parcelPayload } = request.body ?? {};
    const result = await routeSingleParcel(parcelPayload, config ?? fallbackConfig, importedBy, sessionId);

    response.json({
      status: result.result.status,
      createdAt: result.createdAt,
      importedBy: result.importedBy,
      result: result.result
    });
  } catch (error) {
    await recordSingleImportFailure({
      reason: error instanceof Error ? error.message : 'Single import failed'
    });
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
    const sessionId = readSessionId(request.headers as Record<string, unknown>);

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
    await recordBatchImportFailure({
      source: 'batch',
      reason: error instanceof Error ? error.message : 'Batch import failed'
    });
    next(error);
  }
});
