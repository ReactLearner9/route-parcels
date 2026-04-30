import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import type { ParcelInput } from '../core/parcel-types.js';
import type { RoutingResult } from '../core/config-types.js';

export type ParcelRecord = {
  batchId: string | null;
  createdAt: string;
  importedBy: string;
  input: ParcelInput;
  result: RoutingResult;
};

export type ParcelDatabase = {
  records: ParcelRecord[];
};

const dbFile = resolve(process.cwd(), 'data', 'parcel-db.json');

async function ensureDir(filePath: string) {
  await mkdir(dirname(filePath), { recursive: true });
}

export async function getParcelDb() {
  await ensureDir(dbFile);

  const adapter = new JSONFile<ParcelDatabase>(dbFile);
  const db = new Low<ParcelDatabase>(adapter, {
    records: []
  });

  await db.read();
  // Backward-compatible one-time migration for older DB shape.
  if (db.data && !Array.isArray(db.data.records)) {
    const legacy = db.data as unknown as {
      singles?: Array<{
        createdAt: string;
        importedBy: string;
        input: ParcelInput;
        results: RoutingResult;
      }>;
      batches?: Array<{
        batchId?: string;
        createdAt: string;
        importedBy: string;
        input: ParcelInput[];
        results: RoutingResult[];
      }>;
    };
    const migratedRecords: ParcelRecord[] = [];
    for (const single of legacy.singles ?? []) {
      migratedRecords.push({
        batchId: null,
        createdAt: single.createdAt,
        importedBy: single.importedBy,
        input: single.input,
        result: single.results
      });
    }
    for (const batch of legacy.batches ?? []) {
      const inputs = Array.isArray(batch.input) ? batch.input : [];
      const results = Array.isArray(batch.results) ? batch.results : [];
      for (let index = 0; index < Math.min(inputs.length, results.length); index += 1) {
        migratedRecords.push({
          batchId: batch.batchId ?? null,
          createdAt: batch.createdAt,
          importedBy: batch.importedBy,
          input: inputs[index] as ParcelInput,
          result: results[index] as RoutingResult
        });
      }
    }
    db.data = { records: migratedRecords };
    await db.write();
  }

  db.data ??= {
    records: []
  };

  return db;
}

export function makeBatchId() {
  return `${makeFourDigitId()}B`;
}

export function makeParcelId() {
  return `${makeSixDigitId()}S`;
}

function makeFourDigitId() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function makeSixDigitId() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function listParcelRecords(filters?: {
  parcelId?: string;
  batchId?: string;
  importedBy?: string;
}) {
  const db = await getParcelDb();
  const parcelId = filters?.parcelId?.trim().toLowerCase();
  const batchId = filters?.batchId?.trim().toLowerCase();
  const importedBy = filters?.importedBy?.trim().toLowerCase();

  return db.data.records.filter((record) => {
    if (parcelId) {
      const inputId = record.input.id?.toLowerCase();
      const resultId = record.result.parcelId.toLowerCase();
      if (inputId !== parcelId && resultId !== parcelId) return false;
    }
    if (batchId) {
      if ((record.batchId ?? '').toLowerCase() !== batchId) return false;
    }
    if (importedBy) {
      if (record.importedBy.toLowerCase() !== importedBy) return false;
    }
    return true;
  });

}

export async function getParcelCounts() {
  const db = await getParcelDb();
  const batchCount = new Set(
    db.data.records
      .map((record) => record.batchId)
      .filter((value): value is string => typeof value === 'string' && value.length > 0)
  ).size;
  return {
    parcelCount: db.data.records.length,
    batchCount
  };
}
