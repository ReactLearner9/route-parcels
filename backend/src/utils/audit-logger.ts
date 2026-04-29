import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { logger } from './logger.js';

export type LogFeature = 'single-import' | 'batch-import' | 'analytics' | 'config' | 'seed';
export type LogPhase = 'started' | 'ended';

export type AuditEvent = {
  user: string;
  sessionId: string;
  screen: string;
  functionality: string;
  feature: LogFeature;
  phase: LogPhase;
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
    file: resolve(baseDir, `${dateStamp(now)}.json`)
  };
}

export async function logAuditEvent(event: AuditEvent) {
  const timestamp = event.timestamp ?? new Date().toISOString();
  const payload = {
    timestamp,
    sessionId: event.sessionId,
    screen: event.screen,
    functionality: event.functionality,
    phase: event.phase,
    status: event.status,
    durationMs: event.durationMs,
    details: event.details
  };

  const phaseColor = event.phase === 'started' ? '\x1b[33mstarted\x1b[0m' : '\x1b[32mended\x1b[0m';
  const countValue = typeof event.details?.count === 'number' ? event.details.count : undefined;
  const failedCount = typeof event.details?.failedCount === 'number' ? event.details.failedCount : undefined;
  const passedCount = typeof event.details?.passedCount === 'number' ? event.details.passedCount : undefined;
  const countText = countValue === undefined
    ? ''
    : ` \x1b[36mcount=${countValue}\x1b[0m${failedCount !== undefined ? ` \x1b[31mfailed=${failedCount}\x1b[0m` : ''}${passedCount !== undefined ? ` \x1b[32mpassed=${passedCount}\x1b[0m` : ''}`;

  logger.info(payload, `${phaseColor} ${event.screen}.${event.functionality}${countText}`);

  const { dir, file } = getLogFilePath(event.feature, new Date(timestamp));
  await mkdir(dir, { recursive: true });

  let existing: unknown = [];
  try {
    const text = await readFile(file, 'utf8');
    existing = text.trim() ? JSON.parse(text) : [];
  } catch {
    existing = [];
  }

  const list = Array.isArray(existing) ? existing : [];
  list.push(payload);
  await writeFile(file, `${JSON.stringify(list, null, 2)}\n`, 'utf8');
}
