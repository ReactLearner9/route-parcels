import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import type { ParcelInput } from '../core/parcel-types.js';
import type { RoutingResult } from '../core/config-types.js';

export type StoredParcelRecord = {
  batchId?: string;
  source: 'single' | 'batch';
  createdAt: string;
  importedBy: string;
  input: ParcelInput | ParcelInput[];
  results: RoutingResult | RoutingResult[];
};

export type ParcelAuditEvent = {
  id: string;
  batchId: string;
  source: 'single' | 'batch' | 'config';
  step:
    | 'validated'
    | 'routed'
    | 'routing_failed'
    | 'validation_failed'
    | 'uploaded'
    | 'config_applied';
  createdAt: string;
  actor?: string;
  message: string;
  parcelIds?: string[];
  route?: string;
  approvalCount?: number;
  details?: Record<string, unknown>;
};

export type ParcelDatabase = {
  singles: StoredParcelRecord[];
  batches: StoredParcelRecord[];
  audits: ParcelAuditEvent[];
};

const dbFile = resolve(process.cwd(), 'data', 'parcel-db.json');

async function ensureDir(filePath: string) {
  await mkdir(dirname(filePath), { recursive: true });
}

export async function getParcelDb() {
  await ensureDir(dbFile);

  const adapter = new JSONFile<ParcelDatabase>(dbFile);
  const db = new Low<ParcelDatabase>(adapter, {
    singles: [],
    batches: [],
    audits: []
  });

  await db.read();
  db.data ??= {
    singles: [],
    batches: [],
    audits: []
  };

  return db;
}

export function makeBatchId() {
  return `${makeFourDigitId()}B`;
}

export function makeAuditId() {
  return `audit-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

export function makeParcelId() {
  return `${makeFourDigitId()}S`;
}

function makeFourDigitId() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export async function getParcelHistory() {
  const db = await getParcelDb();

  return {
    singles: db.data.singles,
    batches: db.data.batches,
    audits: db.data.audits
  };
}

export async function traceParcel(identifier: string) {
  const db = await getParcelDb();
  const lower = identifier.toLowerCase();
  const singleRecords = db.data.singles;
  const batchRecords = db.data.batches;

  const single = singleRecords.find(
    (record) => {
      const input = record.input as ParcelInput;
      const result = record.results as RoutingResult;

      return (
        record.batchId?.toLowerCase() === lower ||
        input.id?.toLowerCase() === lower ||
        result.parcelId.toLowerCase() === lower
      );
    }
  );

  const batch = batchRecords.find((record) =>
      record.batchId?.toLowerCase() === lower ||
    (Array.isArray(record.input) && record.input.some((parcel) => parcel.id?.toLowerCase() === lower)) ||
    (Array.isArray(record.results) && record.results.some((result) => result.parcelId.toLowerCase() === lower))
  );

  const audits = db.data.audits.filter((audit) => {
    return audit.batchId.toLowerCase() === lower || audit.parcelIds?.some((parcelId) => parcelId.toLowerCase() === lower);
  });

  return {
    single: single ?? null,
    batch: batch ?? null,
    batchId: batch?.batchId ?? '',
    audits
  };
}
