import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { getAuthDb, hashPassword } from '../config/auth-store.js';
import { getConfigDb } from '../config/store.js';
import { getParcelDb, makeAuditId, makeFileId, makeParcelId } from '../config/parcel-store.js';
import { processParcel } from '../core/parcel-processor.js';
import type { RoutingConfig } from '../core/config-types.js';

const dataDir = resolve(process.cwd(), 'data');

const seedConfig: RoutingConfig = {
  rules: [
    { name: 'express-route', type: 'route', priority: 30, when: { field: 'destinationCountry', operator: 'exists' }, action: { department: 'INTERNATIONAL' } },
    { name: 'fragile-handling', type: 'approval', priority: 20, when: { field: 'isFragile', operator: 'is_true' }, action: { approval: 'FRAGILE_HANDLING' } },
    { name: 'regular-route', type: 'route', priority: 10, when: { field: 'weight', operator: '<=', value: 10 }, action: { department: 'REGULAR' } }
  ]
};

export async function resetAndSeedBackend() {
  await rm(dataDir, { recursive: true, force: true });

  const authDb = await getAuthDb();
  authDb.data.users = [
    {
      id: randomUUID(),
      name: 'Admin User',
      email: 'admin@routeparcels.local',
      passwordHash: hashPassword('admin123'),
      role: 'admin',
      createdAt: new Date().toISOString()
    },
    {
      id: randomUUID(),
      name: 'Operator User',
      email: 'operator@routeparcels.local',
      passwordHash: hashPassword('operator123'),
      role: 'operator',
      createdAt: new Date().toISOString()
    }
  ];
  await authDb.write();

  const configDb = await getConfigDb();
  configDb.data.currentVersion = 0;
  configDb.data.versions = [];
  await configDb.write();

  const parcelDb = await getParcelDb();
  parcelDb.data.singles = [];
  parcelDb.data.batches = [];
  parcelDb.data.audits = [];

  const singleParcel = { id: makeParcelId(), weight: 2, value: 1200, destinationCountry: 'DE', isFragile: true };
  const singleFileId = makeFileId();
  const singleResult = processParcel(singleParcel, seedConfig);
  parcelDb.data.singles.push({
    fileId: singleFileId,
    source: 'single',
    createdAt: new Date().toISOString(),
    input: singleParcel,
    results: singleResult
  });
  parcelDb.data.audits.push({
    id: makeAuditId(),
    fileId: singleFileId,
    source: 'single',
    createdAt: new Date().toISOString(),
    step: 'routed',
    message: `Seeded single parcel ${singleParcel.id}`,
    parcelIds: [singleParcel.id],
    route: singleResult.route
  });

  const batchFileId = makeFileId();
  const batchParcels = [
    { id: makeParcelId(), weight: 1, value: 90, destinationCountry: 'NL' },
    { id: makeParcelId(), weight: 14, value: 180, destinationCountry: 'BR' }
  ];
  const batchResults = batchParcels.map((parcel) => processParcel(parcel, seedConfig));
  parcelDb.data.batches.push({
    fileId: batchFileId,
    source: 'batch',
    createdAt: new Date().toISOString(),
    input: batchParcels,
    results: batchResults
  });
  parcelDb.data.audits.push({
    id: makeAuditId(),
    fileId: batchFileId,
    source: 'batch',
    createdAt: new Date().toISOString(),
    step: 'routed',
    message: `Seeded batch file with ${batchParcels.length} parcels`,
    parcelIds: batchParcels.map((parcel) => parcel.id)
  });

  await parcelDb.write();

  return {
    configVersion: 0,
    singleFileId,
    batchFileId
  };
}
