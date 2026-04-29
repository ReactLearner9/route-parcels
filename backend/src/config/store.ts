import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import type { RoutingConfig } from '../core/config-types.js';

export type ConfigStore = {
  currentConfig: RoutingConfig | null;
};

const approvalConfigDbFile = resolve(process.cwd(), 'data', 'approval-config-db.json');
const routingConfigDbFile = resolve(process.cwd(), 'data', 'routing-config-db.json');

async function ensureDir(filePath: string) {
  await mkdir(dirname(filePath), { recursive: true });
}

async function createConfigDb(filePath: string) {
  await ensureDir(filePath);

  const adapter = new JSONFile<ConfigStore>(filePath);
  const db = new Low<ConfigStore>(adapter, {
    currentConfig: null,
  });

  await db.read();
  db.data ??= {
    currentConfig: null,
  };

  return db;
}

export async function getApprovalConfigDb() {
  return createConfigDb(approvalConfigDbFile);
}

export async function getRoutingConfigDb() {
  return createConfigDb(routingConfigDbFile);
}

export async function getCurrentApprovalConfig() {
  const db = await getApprovalConfigDb();
  return db.data.currentConfig;
}

export async function getCurrentRoutingConfig() {
  const db = await getRoutingConfigDb();
  return db.data.currentConfig;
}
