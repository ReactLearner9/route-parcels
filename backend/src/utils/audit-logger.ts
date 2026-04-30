import { appendFile, mkdir, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { logger } from './logger.js';

export type LogFeature = 'single-import' | 'batch-import' | 'analytics' | 'config' | 'seed';

export type AuditEvent = {
  user: string;
  sessionId: string;
  screen: string;
  functionality: string;
  feature: LogFeature;
  status?: 'passed' | 'failed' | 'success' | 'not_found' | 'found';
  timestamp?: string;
  durationMs?: number;
  details?: Record<string, unknown>;
};

function dateStamp(value: Date) {
  return value.toISOString().slice(0, 10);
}

function sanitizeFilePart(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9-]/g, '-');
}

function getLogFilePath(feature: LogFeature, now = new Date()) {
  const baseDir = resolve(process.cwd(), 'data', 'logs', sanitizeFilePart(feature));
  return {
    dir: baseDir,
    file: resolve(baseDir, `${dateStamp(now)}.csv`)
  };
}

const csvHeader = 'timestamp,sessionId,user,screen,functionality,status,durationMs,details\n';

function csvValue(value: unknown) {
  const text = value == null ? '' : String(value);
  const escaped = text.replace(/"/g, '""');
  return `"${escaped}"`;
}

async function ensureCsvHeader(file: string) {
  try {
    await stat(file);
  } catch {
    await writeFile(file, csvHeader, 'utf8');
  }
}

export async function logAuditEvent(event: AuditEvent) {
  const timestamp = event.timestamp ?? new Date().toISOString();
  const payload = {
    timestamp,
    sessionId: event.sessionId,
    user: event.user,
    screen: event.screen,
    functionality: event.functionality,
    status: event.status,
    durationMs: event.durationMs,
    details: event.details
  };

  const countValue = typeof event.details?.count === 'number' ? event.details.count : undefined;
  const failedCount = typeof event.details?.failedCount === 'number' ? event.details.failedCount : undefined;
  const passedCount = typeof event.details?.passedCount === 'number' ? event.details.passedCount : undefined;
  const durationText = typeof event.durationMs === 'number' ? ` \x1b[35mduration=${event.durationMs}ms\x1b[0m` : '';
  const countText = countValue === undefined
    ? ''
    : ` \x1b[36mcount=${countValue}\x1b[0m${failedCount !== undefined ? ` \x1b[31mfailed=${failedCount}\x1b[0m` : ''}${passedCount !== undefined ? ` \x1b[32mpassed=${passedCount}\x1b[0m` : ''}`;

  logger.info(payload, `event ${event.screen}.${event.functionality}${durationText}${countText}`);

  if (event.feature === 'analytics' || event.feature === 'seed') {
    return;
  }

  const { dir, file } = getLogFilePath(event.feature, new Date(timestamp));
  await mkdir(dir, { recursive: true });
  await ensureCsvHeader(file);

  const line = [
    csvValue(timestamp),
    csvValue(event.sessionId),
    csvValue(event.user),
    csvValue(event.screen),
    csvValue(event.functionality),
    csvValue(event.status ?? ''),
    csvValue(event.durationMs ?? ''),
    csvValue(event.details ? JSON.stringify(event.details) : '')
  ].join(',') + '\n';
  await appendFile(file, line, 'utf8');
}
