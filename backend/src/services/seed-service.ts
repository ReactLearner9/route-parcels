import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { getAuthDb, hashPassword } from '../config/auth-store.js';
import { getApprovalConfigDb, getRoutingConfigDb } from '../config/store.js';
import { getParcelDb, makeAuditId, makeBatchId, makeParcelId } from '../config/parcel-store.js';
import { processParcel } from '../core/parcel-processor.js';
import type { RoutingConfig } from '../core/config-types.js';

const dataDir = resolve(process.cwd(), 'data');

const seedConfig: RoutingConfig = {
  rules: [
    { type: 'approval', when: { field: 'destination.country', operator: '==', value: 'DE' }, action: { approval: 'EU_CHECK' } },
    { type: 'approval', when: { field: 'value', operator: '>', value: 1000 }, action: { approval: 'INSURANCE' } },
    { type: 'route', priority: 1, when: { field: 'fragile', operator: 'is_true' }, action: { department: 'SPECIAL_HANDLING' } },
    { type: 'route', priority: 2, when: { field: 'delivery.signatureRequired', operator: 'is_false' }, action: { department: 'NO_SIGNATURE_NEEDED' } },
    { type: 'route', priority: 3, when: { field: 'weight', operator: '<=', value: 1 }, action: { department: 'MAIL' } },
    { type: 'route', priority: 4, when: { field: 'weight', operator: '<=', value: 10 }, action: { department: 'REGULAR' } },
    { type: 'route', priority: 5, when: { field: 'weight', operator: '>', value: 10 }, action: { department: 'HEAVY' } },
    { type: 'route', priority: Number.MAX_SAFE_INTEGER, when: { field: 'weight', operator: '>', value: 0 }, action: { department: 'MANUAL_REVIEW' } }
  ]
};

async function seedUsersOnly() {
  const authDb = await getAuthDb();
  authDb.data.users = [
    {
      id: randomUUID(),
      username: 'admin',
      passwordHash: hashPassword('admin123'),
      role: 'admin',
      createdAt: new Date().toISOString()
    },
    {
      id: randomUUID(),
      username: 'operator',
      passwordHash: hashPassword('operator123'),
      role: 'operator',
      createdAt: new Date().toISOString()
    }
  ];
  await authDb.write();
}

async function seedConfigVersions() {
  const approvalDb = await getApprovalConfigDb();
  const routingDb = await getRoutingConfigDb();
  const timestamp = new Date().toISOString();
  const addSeedMetadata = <Rule extends RoutingConfig['rules'][number]>(rule: Rule): Rule => ({
    ...rule,
    createdBy: 'system',
    createdAt: timestamp,
    lastModifiedBy: 'system',
    lastModifiedAt: timestamp
  });
  approvalDb.data.currentConfig = {
    rules: seedConfig.rules.filter((rule) => rule.type === 'approval').map(addSeedMetadata)
  };
  routingDb.data.currentConfig = {
    rules: seedConfig.rules.filter((rule) => rule.type === 'route').map(addSeedMetadata)
  };
  await Promise.all([approvalDb.write(), routingDb.write()]);
}

async function seedParcelAndBatchData() {
  const parcelDb = await getParcelDb();
  parcelDb.data.singles = [];
  parcelDb.data.batches = [];
  parcelDb.data.audits = [];

  for (let index = 0; index < 10; index += 1) {
    const parcel = {
      id: makeParcelId(),
      weight: 1 + (index % 12),
      value: 80 + index * 40,
    };
    const batchId = makeBatchId();
    const results = processParcel(parcel, seedConfig);
    parcelDb.data.singles.push({
      batchId,
      source: 'single',
      createdAt: new Date().toISOString(),
      importedBy: 'system',
      input: parcel,
      results
    });
  }

  for (let batchIndex = 0; batchIndex < 2; batchIndex += 1) {
    const batchId = makeBatchId();
    const parcelCount = 20 + Math.floor(Math.random() * 11);
    const input = Array.from({ length: parcelCount }, (_, index) => ({
      id: makeParcelId(),
      weight: 1 + ((index + batchIndex) % 18),
      value: 60 + index * 15
    }));
    const results = input.map((parcel) => processParcel(parcel, seedConfig));
    parcelDb.data.batches.push({
      batchId,
      source: 'batch',
      createdAt: new Date().toISOString(),
      importedBy: 'system',
      input,
      results
    });
  }

  await parcelDb.write();
}

export async function resetAndSeedBackend() {
  await rm(dataDir, { recursive: true, force: true });
  await seedUsersOnly();
  await seedConfigVersions();
  await seedParcelAndBatchData();

  return { ok: true };
}

export async function seedParcelAndBatchDataOnly() {
  await seedParcelAndBatchData();
  return { ok: true };
}

export async function seedConfigDataOnly() {
  await seedConfigVersions();
  return { ok: true };
}
