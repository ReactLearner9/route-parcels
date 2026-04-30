import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';

export type AlertLevel = 'alert' | 'info';

export type AlertRecord = {
  id: string;
  name: string;
  level: AlertLevel;
  reason: string;
  triggeredAt: string;
  details?: Record<string, unknown>;
};

export type AlertDatabase = {
  alerts: AlertRecord[];
};

const dbFile = resolve(process.cwd(), 'data', 'alerts-db.json');

async function ensureDir(filePath: string) {
  await mkdir(dirname(filePath), { recursive: true });
}

export async function getAlertDb() {
  await ensureDir(dbFile);
  const adapter = new JSONFile<AlertDatabase>(dbFile);
  const db = new Low<AlertDatabase>(adapter, { alerts: [] });
  await db.read();
  db.data ??= { alerts: [] };
  return db;
}

export function makeAlertId() {
  return randomUUID();
}
