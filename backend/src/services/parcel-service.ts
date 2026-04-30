import type { RoutingConfig, RoutingResult } from '../core/config-types.js';
import { batchParcelsSchema, parcelSchema, type BatchParcelsInput, type ParcelInput } from '../core/parcel-types.js';
import { processParcel } from '../core/parcel-processor.js';
import { getParcelDb, makeBatchId, makeParcelId, type ParcelRecord } from '../config/parcel-store.js';
import { validateParcelAgainstRules } from '../core/parcel-validation.js';
import { logger } from '../utils/logger.js';
import { logAuditEvent } from '../utils/audit-logger.js';
import { ZodError } from 'zod';
import { Worker } from 'node:worker_threads';

type MulterFile = Express.Multer.File;
const megaWorkerCode = `
  import { parentPort, workerData } from 'node:worker_threads';
  import { tsImport } from 'tsx/esm/api';

  const [{ batchParcelsSchema }, { processParcel }, { makeBatchId, makeParcelId }] = await Promise.all([
    tsImport(workerData.parcelTypesModuleUrl, import.meta.url),
    tsImport(workerData.parcelProcessorModuleUrl, import.meta.url),
    tsImport(workerData.parcelStoreModuleUrl, import.meta.url)
  ]);

  parentPort.on('message', ({ fileText, config }) => {
    try {
      const payload = JSON.parse(fileText);
      const parsed = batchParcelsSchema.parse(payload);
      const batchId = makeBatchId();
      const results = parsed.parcels.map((parcel) => {
        const normalizedParcel = { ...parcel, id: parcel.id ?? makeParcelId() };
        return processParcel(normalizedParcel, config);
      });
      parentPort.postMessage({ batchId, results });
    } catch (error) {
      parentPort.postMessage({
        error: error instanceof Error ? error.message : 'Mega batch processing failed'
      });
    }
  });
`;

function normalizeActor(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : 'system';
}

export type ValidationIssueRow = {
  rowNo: number;
  field: string;
  reason: string;
};

export type ValidationReport = {
  valid: boolean;
  issues: ValidationIssueRow[];
};

export type MegaBatchOutcome =
  | {
      status: 'validation_failed';
      fileName: string;
      fileContent: string;
      recordCount: number;
      validationIssueCount: number;
    }
  | {
      status: 'processed';
      batchId: string;
      fileName: string;
      fileContent: string;
      recordCount: number;
      validationIssueCount: 0;
    };

function humanizePath(path: PropertyKey[]) {
  if (!path.length) return 'data';
  return path.map(String).join('.');
}

function explainZodIssue(
  issue: { path: PropertyKey[]; message: string; code?: string },
  context: 'parcel' | 'batch' | 'config',
): Omit<ValidationIssueRow, 'rowNo'> {
  const field = humanizePath(issue.path);
  const readableField =
    field === 'data'
      ? 'the submitted data'
      : field === 'parcels'
        ? 'the parcels list'
        : field.replace(/^parcels\.(\d+)\./, (_match, index: string) => `row ${Number(index) + 1} `);

  if (context === 'parcel') {
    if (field === 'id') {
      return {
        field,
        reason: 'The parcel ID is invalid or empty.',
      };
    }
    if (field === 'weight') {
      return {
        field,
        reason: 'The parcel weight is missing, zero, or not a number.',
      };
    }
    if (field === 'value') {
      return {
        field,
        reason: 'The parcel value is missing, zero, or not a number.',
      };
    }
  }

  if (context === 'batch') {
    if (field === 'parcels') {
      return {
        field,
        reason: 'The file must contain a parcels list.',
      };
    }
  }

  if (context === 'config') {
    if (field.includes('when.operator')) {
      return {
        field,
        reason: 'One rule uses a condition the system does not understand.',
      };
    }
    if (field.includes('action.department')) {
      return {
        field,
        reason: 'A route rule is missing its department.',
      };
    }
    if (field.includes('action.approval')) {
      return {
        field,
        reason: 'An approval rule is missing the approval name.',
      };
    }
  }

  return {
    field: readableField,
    reason: issue.message,
  };
}

export function validateSingleParcel(payload: unknown): ParcelInput {
  const result = parcelSchema.safeParse(payload);
  if (!result.success) {
    throw result.error;
  }
  return result.data;
}

export function validateBatchPayload(payload: unknown): BatchParcelsInput {
  const result = batchParcelsSchema.safeParse(payload);
  if (!result.success) {
    throw result.error;
  }
  return result.data;
}

function csvCell(value: unknown) {
  const text = value == null ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function megaTimestampFilePart() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function countParcelsInPayload(payload: unknown) {
  if (
    payload &&
    typeof payload === 'object' &&
    'parcels' in payload &&
    Array.isArray((payload as { parcels?: unknown[] }).parcels)
  ) {
    return (payload as { parcels: unknown[] }).parcels.length;
  }
  return 0;
}

function buildValidationCsv(issues: ValidationIssueRow[]) {
  const header = 'rowNo,field,reason';
  const rows = issues.map((issue) =>
    [issue.rowNo, issue.field, issue.reason].map(csvCell).join(',')
  );
  return [header, ...rows].join('\n');
}

function buildMegaResultsCsv(batchId: string, results: RoutingResult[]) {
  const header = 'batchId,parcelId,status,route,toBeRouted,routedTo,approvals';
  const rows = results.map((result) =>
    [
      batchId,
      result.parcelId,
      result.status ?? '',
      result.route,
      result.toBeRouted,
      result.routedTo,
      result.approvals.join('|')
    ].map(csvCell).join(',')
  );
  return [header, ...rows].join('\n');
}

async function runMegaBatchWorker(fileText: string, config: RoutingConfig) {
  return new Promise<{ batchId: string; results: RoutingResult[] }>((resolve, reject) => {
    const workerOptions = {
      eval: true,
      type: 'module',
      workerData: {
        parcelTypesModuleUrl: new URL('../core/parcel-types.ts', import.meta.url).href,
        parcelProcessorModuleUrl: new URL('../core/parcel-processor.ts', import.meta.url).href,
        parcelStoreModuleUrl: new URL('../config/parcel-store.ts', import.meta.url).href
      }
    } as import('node:worker_threads').WorkerOptions;
    const worker = new Worker(megaWorkerCode, workerOptions);

    worker.once('message', (message: { error?: string; batchId?: string; results?: RoutingResult[] }) => {
      worker.terminate().catch(() => undefined);
      if (message.error) {
        reject(new Error(message.error));
        return;
      }
      resolve({
        batchId: message.batchId ?? makeBatchId(),
        results: message.results ?? []
      });
    });

    worker.once('error', (error) => {
      worker.terminate().catch(() => undefined);
      reject(error);
    });

    worker.postMessage({ fileText, config });
  });
}

export async function validateSingleParcelPayload(payload: unknown, config: RoutingConfig | null = null): Promise<ValidationReport> {
  try {
    const parsed = validateSingleParcel(payload);
    const issues = validateParcelAgainstRules(parsed as unknown as import('../core/config-types.js').Parcel, config?.rules ?? [], {
      requireKnownCoreFields: true,
    });
    return { valid: issues.length === 0, issues: issues.map((issue) => ({ rowNo: 1, ...issue })) };
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        valid: false,
        issues: error.issues.map((issue) => ({
          rowNo: 1,
          ...explainZodIssue(issue, 'parcel'),
        })),
      };
    }
    throw error;
  }
}

export async function validateBatchFilePayload(file: MulterFile, config: RoutingConfig | null = null): Promise<ValidationReport> {
  let payload: unknown;

  try {
    payload = JSON.parse(file.buffer.toString('utf8'));
  } catch {
      return {
        valid: false,
        issues: [
          {
            rowNo: 1,
            field: 'file',
            reason: 'The batch file is not valid JSON',
          },
        ],
      };
  }

  const result = batchParcelsSchema.safeParse(payload);
  if (!result.success) {
    return {
      valid: false,
      issues: result.error.issues.map((issue) => ({
        rowNo: typeof issue.path[1] === 'number' ? Number(issue.path[1]) + 1 : 1,
        ...explainZodIssue(issue, 'batch'),
      })),
    };
  }

  const issues: ValidationIssueRow[] = [];
  result.data.parcels.forEach((parcel, index) => {
    const parsed = parcelSchema.safeParse(parcel);
    if (!parsed.success) {
      issues.push(
        ...parsed.error.issues.map((issue) => ({
          rowNo: index + 1,
          ...explainZodIssue(issue, 'parcel'),
        })),
      );
      return;
    }
    const dynamicIssues = validateParcelAgainstRules(parsed.data as unknown as import('../core/config-types.js').Parcel, config?.rules ?? [], {
      requireKnownCoreFields: true,
    });
    issues.push(
      ...dynamicIssues.map((issue) => ({
        rowNo: index + 1,
        ...issue,
      })),
    );
  });

  return { valid: issues.length === 0, issues };
}

export async function routeSingleParcel(payload: unknown, config: RoutingConfig, importedBy = 'system', sessionId = 'backend') {
  const createdAt = new Date().toISOString();
  const actor = normalizeActor(importedBy);
  const db = await getParcelDb();

  try {
    const parcel = validateSingleParcel(payload);
    const normalizedParcel = { ...parcel, id: parcel.id ?? makeParcelId() };

    const result = processParcel(normalizedParcel, config);

    const record: ParcelRecord = {
      batchId: null,
      createdAt,
      importedBy: actor,
      input: normalizedParcel,
      result
    };

    db.data.records.push(record);

    await db.write();
    await logAuditEvent({
      user: actor,
      sessionId,
      screen: 'Import Single',
      functionality: 'single_import',
      feature: 'single-import',
      status: 'success',
      details: { generatedParcelId: result.parcelId, route: result.route }
    });

    logger.info({ parcelId: normalizedParcel.id, route: result.route }, 'single parcel routed');

    return { createdAt, importedBy: actor, result };
  } catch (error) {
    throw error;
  }
}

export async function routeBatchFromFile(file: MulterFile, config: RoutingConfig, importedBy = 'system', sessionId = 'backend') {
  let payload: unknown;
  const actor = normalizeActor(importedBy);

  try {
    payload = JSON.parse(file.buffer.toString('utf8'));
  } catch {
    throw new Error('Batch file must be valid JSON that contains a parcels list');
  }

  const parsed = validateBatchPayload(payload);
  const batchId = makeBatchId();
  const createdAt = new Date().toISOString();
  const normalizedParcels = parsed.parcels.map((parcel) => ({ ...parcel, id: parcel.id ?? makeParcelId() }));
  const results = normalizedParcels.map((parcel) => processParcel(parcel, config));
  const db = await getParcelDb();
  const records: ParcelRecord[] = normalizedParcels.map((parcel, index) => ({
    batchId,
    createdAt,
    importedBy: actor,
    input: parcel,
    result: results[index] as RoutingResult
  }));
  db.data.records.push(...records);
  await db.write();
  await logAuditEvent({
    user: actor,
    sessionId,
    screen: 'Import Batch',
    functionality: 'batch_import',
    feature: 'batch-import',
    status: 'success',
    details: { batchId, count: results.length }
  });

  logger.info(
    { batchId, count: normalizedParcels.length, parcelIds: normalizedParcels.map((parcel) => parcel.id) },
    'batch parcel upload processed'
  );

  return { batchId, createdAt, importedBy: actor, results };
}

export async function processMegaBatchFile(
  file: MulterFile,
  config: RoutingConfig,
  importedBy = 'system',
  sessionId = 'backend'
): Promise<MegaBatchOutcome> {
  const actor = normalizeActor(importedBy);
  const fileText = file.buffer.toString('utf8');
  let payload: unknown;

  try {
    payload = JSON.parse(fileText);
  } catch {
    const issues: ValidationIssueRow[] = [
      {
        rowNo: 1,
        field: 'file',
        reason: 'The batch file is not valid JSON'
      }
    ];
    await logAuditEvent({
      user: actor,
      sessionId,
      screen: 'Mega Batch Import',
      functionality: 'mega_batch_validate',
      feature: 'batch-import',
      status: 'failed',
      details: { count: 0, failedCount: 1, passedCount: 0 }
    });
    return {
      status: 'validation_failed',
      fileName: `mega-validation-report-${megaTimestampFilePart()}.csv`,
      fileContent: buildValidationCsv(issues),
      recordCount: 0,
      validationIssueCount: 1
    };
  }

  const recordCount = countParcelsInPayload(payload);
  const validation = await validateBatchFilePayload(file, config);
  if (!validation.valid) {
    const failedCount = new Set(validation.issues.map((issue) => issue.rowNo)).size;
    await logAuditEvent({
      user: actor,
      sessionId,
      screen: 'Mega Batch Import',
      functionality: 'mega_batch_validate',
      feature: 'batch-import',
      status: 'failed',
      details: { count: recordCount, failedCount, passedCount: Math.max(0, recordCount - failedCount) }
    });
    return {
      status: 'validation_failed',
      fileName: `mega-validation-report-${megaTimestampFilePart()}.csv`,
      fileContent: buildValidationCsv(validation.issues),
      recordCount,
      validationIssueCount: validation.issues.length
    };
  }

  const processed = await runMegaBatchWorker(fileText, config);
  await logAuditEvent({
    user: actor,
    sessionId,
    screen: 'Mega Batch Import',
    functionality: 'mega_batch_import',
    feature: 'batch-import',
    status: 'success',
    details: { batchId: processed.batchId, count: processed.results.length }
  });

  logger.info(
    { batchId: processed.batchId, count: processed.results.length },
    'mega batch parcel upload processed'
  );

  return {
    status: 'processed',
    batchId: processed.batchId,
    fileName: `${processed.batchId}-mega-results.csv`,
    fileContent: buildMegaResultsCsv(processed.batchId, processed.results),
    recordCount: processed.results.length,
    validationIssueCount: 0
  };
}
