import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import type { ParcelInput } from '../core/parcel-types.js';
import type { RoutingResult } from '../core/config-types.js';

export type StoredParcelRecord = {
  fileId: string;
  source: 'single' | 'batch';
  createdAt: string;
  input: ParcelInput | ParcelInput[];
  results: RoutingResult | RoutingResult[];
};

export type ParcelAuditEvent = {
  id: string;
  fileId: string;
  source: 'single' | 'batch' | 'config';
  step:
    | 'validated'
    | 'routed'
    | 'routing_failed'
    | 'validation_failed'
    | 'uploaded'
    | 'config_applied';
  createdAt: string;
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

export function makeFileId(prefix: 'single' | 'batch') {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

export function makeAuditId() {
  return `audit-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}
