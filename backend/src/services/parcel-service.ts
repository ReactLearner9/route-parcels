import type { RoutingConfig, RoutingResult } from '../core/config-types.js';
import { batchParcelsSchema, parcelSchema, type BatchParcelsInput, type ParcelInput } from '../core/parcel-types.js';
import { processParcel } from '../core/parcel-processor.js';
import { getParcelDb, makeAuditId, makeBatchId, makeParcelId, type StoredParcelRecord } from '../config/parcel-store.js';
import { validateParcelAgainstRules } from '../core/parcel-validation.js';
import { logger } from '../utils/logger.js';
import { ZodError } from 'zod';

type MulterFile = Express.Multer.File;

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

export async function routeSingleParcel(payload: unknown, config: RoutingConfig, importedBy = 'system') {
  const createdAt = new Date().toISOString();
  const actor = normalizeActor(importedBy);
  const db = await getParcelDb();
  const auditBase = {
    batchId: makeBatchId(),
    source: 'single' as const,
    createdAt,
    actor
  };

  try {
    const parcel = validateSingleParcel(payload);
    const normalizedParcel = { ...parcel, id: parcel.id ?? makeParcelId() };
    db.data.audits.push({
      id: makeAuditId(),
      ...auditBase,
      step: 'validated',
      message: `Single parcel ${normalizedParcel.id} validated`,
      parcelIds: [normalizedParcel.id]
    });

    const result = processParcel(normalizedParcel, config);

    const record: StoredParcelRecord = {
      source: 'single',
      createdAt,
      importedBy: actor,
      input: normalizedParcel,
      results: result
    };

    db.data.singles.push(record);
    db.data.audits.push({
      id: makeAuditId(),
      ...auditBase,
      step: 'routed',
      message: `Single parcel ${normalizedParcel.id} routed to ${result.route}`,
      parcelIds: [normalizedParcel.id],
      route: result.route,
      approvalCount: result.approvals.length
    });

    await db.write();

    logger.info({ parcelId: normalizedParcel.id, route: result.route }, 'single parcel routed');

    return { createdAt, importedBy: actor, result };
  } catch (error) {
    throw error;
  }
}

export async function routeBatchFromFile(file: MulterFile, config: RoutingConfig, importedBy = 'system') {
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

  const record: StoredParcelRecord = {
    batchId,
    source: 'batch',
    createdAt,
    importedBy: actor,
    input: normalizedParcels,
    results
  };

  db.data.batches.push(record);
  db.data.audits.push({
    id: makeAuditId(),
    batchId,
    source: 'batch',
    createdAt: new Date().toISOString(),
    actor,
    step: 'uploaded',
    message: `Batch file ${file.originalname} uploaded with ${normalizedParcels.length} parcels`,
    parcelIds: normalizedParcels.map((parcel) => parcel.id)
  });
  db.data.audits.push({
    id: makeAuditId(),
    batchId,
    source: 'batch',
    createdAt: new Date().toISOString(),
    actor,
    step: 'validated',
    message: `Batch file ${file.originalname} validated`,
    parcelIds: normalizedParcels.map((parcel) => parcel.id)
  });
  db.data.audits.push({
    id: makeAuditId(),
    batchId,
    source: 'batch',
    createdAt: new Date().toISOString(),
    actor,
    step: 'routed',
    message: `Batch file ${file.originalname} routed`,
    parcelIds: normalizedParcels.map((parcel) => parcel.id)
  });
  await db.write();

  logger.info(
    { batchId, count: normalizedParcels.length, parcelIds: normalizedParcels.map((parcel) => parcel.id) },
    'batch parcel upload processed'
  );

  return { batchId, createdAt, importedBy: actor, results };
}
