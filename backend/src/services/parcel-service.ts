import type { RoutingConfig, RoutingResult } from '../core/config-types.js';
import { batchParcelsSchema, parcelSchema, type BatchParcelsInput, type ParcelInput } from '../core/parcel-types.js';
import { processParcel } from '../core/parcel-processor.js';
import { getParcelDb, makeAuditId, makeFileId, type StoredParcelRecord } from '../config/parcel-store.js';
import { logger } from '../utils/logger.js';

type MulterFile = Express.Multer.File;

export function validateSingleParcel(payload: unknown): ParcelInput {
  return parcelSchema.parse(payload);
}

export function validateBatchPayload(payload: unknown): BatchParcelsInput {
  return batchParcelsSchema.parse(payload);
}

export async function validateSingleParcelPayload(payload: unknown) {
  return validateSingleParcel(payload);
}

export async function validateBatchFilePayload(file: MulterFile) {
  let payload: unknown;

  try {
    payload = JSON.parse(file.buffer.toString('utf8'));
  } catch {
    throw new Error('Batch file must contain valid JSON');
  }

  return validateBatchPayload(payload);
}

export async function routeSingleParcel(payload: unknown, config: RoutingConfig) {
  const fileId = makeFileId();
  const db = await getParcelDb();
  const auditBase = {
    fileId,
    source: 'single' as const,
    createdAt: new Date().toISOString()
  };

  try {
    const parcel = validateSingleParcel(payload);
    db.data.audits.push({
      id: makeAuditId(),
      ...auditBase,
      step: 'validated',
      message: `Single parcel ${parcel.id} validated`,
      parcelIds: [parcel.id]
    });

    const result = processParcel(parcel, config);

    const record: StoredParcelRecord = {
      fileId,
      source: 'single',
      createdAt: new Date().toISOString(),
      input: parcel,
      results: result
    };

    db.data.singles.push(record);
    db.data.audits.push({
      id: makeAuditId(),
      ...auditBase,
      step: 'routed',
      message: `Single parcel ${parcel.id} routed to ${result.route}`,
      parcelIds: [parcel.id],
      route: result.route,
      approvalCount: result.approvals.length
    });

    await db.write();

    logger.info({ fileId, parcelId: parcel.id, route: result.route }, 'single parcel routed');

    return { fileId, result };
  } catch (error) {
    db.data.audits.push({
      id: makeAuditId(),
      ...auditBase,
      step: 'validation_failed',
      message: error instanceof Error ? error.message : 'Single parcel validation failed',
      details: { error: error instanceof Error ? error.message : String(error) }
    });
    await db.write();
    throw error;
  }
}

export async function routeBatchFromFile(file: MulterFile, config: RoutingConfig) {
  let payload: unknown;

  try {
    payload = JSON.parse(file.buffer.toString('utf8'));
  } catch {
    throw new Error('Batch file must contain valid JSON');
  }

  const parsed = validateBatchPayload(payload);
  const fileId = makeFileId();
  const results = parsed.parcels.map((parcel) => processParcel(parcel, config));
  const db = await getParcelDb();

  const record: StoredParcelRecord = {
    fileId,
    source: 'batch',
    createdAt: new Date().toISOString(),
    input: parsed.parcels,
    results
  };

  db.data.batches.push(record);
  db.data.audits.push({
    id: makeAuditId(),
    fileId,
    source: 'batch',
    createdAt: new Date().toISOString(),
    step: 'uploaded',
    message: `Batch file ${file.originalname} uploaded with ${parsed.parcels.length} parcels`,
    parcelIds: parsed.parcels.map((parcel) => parcel.id)
  });
  db.data.audits.push({
    id: makeAuditId(),
    fileId,
    source: 'batch',
    createdAt: new Date().toISOString(),
    step: 'validated',
    message: `Batch file ${file.originalname} validated`,
    parcelIds: parsed.parcels.map((parcel) => parcel.id)
  });
  db.data.audits.push({
    id: makeAuditId(),
    fileId,
    source: 'batch',
    createdAt: new Date().toISOString(),
    step: 'routed',
    message: `Batch file ${file.originalname} routed`,
    parcelIds: parsed.parcels.map((parcel) => parcel.id)
  });
  await db.write();

  logger.info(
    { fileId, count: parsed.parcels.length, parcelIds: parsed.parcels.map((parcel) => parcel.id) },
    'batch parcel upload processed'
  );

  return { fileId, results };
}
