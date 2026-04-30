import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Request } from 'express';
import { ZodError } from 'zod';

function dateStamp(value: Date) {
  return value.toISOString().slice(0, 10);
}

const header = 's_no,timestamp,session_id,error_message\n';

function csvValue(value: unknown) {
  const text = value == null ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

async function ensureHeader(file: string) {
  try {
    const text = await readFile(file, 'utf8');
    if (!text.trim()) await writeFile(file, header, 'utf8');
  } catch {
    await writeFile(file, header, 'utf8');
  }
}

async function nextSerial(file: string) {
  try {
    const text = await readFile(file, 'utf8');
    const lines = text.split('\n').filter((line) => line.trim().length > 0);
    return Math.max(1, lines.length);
  } catch {
    return 1;
  }
}

function detailedMessage(error: unknown) {
  if (error instanceof ZodError) return JSON.stringify(error.issues);
  if (error instanceof Error) return error.message;
  return String(error);
}

export async function logExceptionToFile(request: Request, error: unknown) {
  const dir = resolve(process.cwd(), 'data', 'logs', 'exceptions');
  const now = new Date();
  const file = resolve(dir, `${dateStamp(now)}.csv`);
  await mkdir(dir, { recursive: true });
  await ensureHeader(file);
  const serial = await nextSerial(file);
  const sessionId = request.headers['x-session-id'];

  const line = [
    csvValue(serial),
    csvValue(now.toISOString()),
    csvValue(typeof sessionId === 'string' ? sessionId : ''),
    csvValue(detailedMessage(error))
  ].join(',') + '\n';

  await appendFile(file, line, 'utf8');
}
