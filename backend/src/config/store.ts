import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import type { RoutingConfig } from '../core/config-types.js';

export type StoredConfigVersion = {
  changeId: string;
  version: number;
  createdAt: string;
  checksum: string;
  config: RoutingConfig;
};

export type ConfigDraft = {
  checksum: string;
  createdAt: string;
  filename: string;
  config: RoutingConfig;
  valid: boolean;
};

export type ConfigDatabase = {
  currentVersion: number;
  versions: StoredConfigVersion[];
};

const dbFile = resolve(process.cwd(), 'data', 'config-db.json');

async function ensureDir(filePath: string) {
  await mkdir(dirname(filePath), { recursive: true });
}

export async function getConfigDb() {
  await ensureDir(dbFile);

  const adapter = new JSONFile<ConfigDatabase>(dbFile);
  const db = new Low<ConfigDatabase>(adapter, {
    currentVersion: 0,
    versions: []
  });

  await db.read();
  db.data ??= {
    currentVersion: 0,
    versions: []
  };

  return db;
}

export async function getCurrentConfig() {
  const db = await getConfigDb();
  return db.data.versions.find((entry) => entry.version === db.data.currentVersion) ?? null;
}

export function makeConfigChangeId() {
  return `${String(Math.floor(1000 + Math.random() * 9000))}C`;
}
