import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { z } from 'zod';

const userRoleSchema = z.enum(['admin', 'operator']);

export const authUserSchema = z.object({
  id: z.string().min(1),
  username: z.string().min(1),
  passwordHash: z.string().min(1),
  role: userRoleSchema,
  createdAt: z.string()
});

export type AuthUser = z.infer<typeof authUserSchema>;
export type AuthRole = z.infer<typeof userRoleSchema>;

export type AuthDatabase = {
  users: AuthUser[];
};

const dbFile = resolve(process.cwd(), 'data', 'auth-db.json');

async function ensureDir(filePath: string) {
  await mkdir(dirname(filePath), { recursive: true });
}

export function hashPassword(password: string) {
  return createHash('sha256').update(password).digest('hex');
}

export async function getAuthDb() {
  await ensureDir(dbFile);
  const adapter = new JSONFile<AuthDatabase>(dbFile);
  const db = new Low<AuthDatabase>(adapter, { users: [] });
  await db.read();
  db.data ??= { users: [] };
  return db;
}

export async function findUserByUsername(username: string) {
  const db = await getAuthDb();
  return db.data.users.find((user) => user.username.toLowerCase() === username.toLowerCase()) ?? null;
}
