import { appendFile, mkdir, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { logger } from './logger.js';

type AlertLogEvent = {
  action: 'created' | 'read';
  alertId: string;
  alertName: string;
  level: 'alert' | 'info';
  user: string;
  timestamp?: string;
  details?: Record<string, unknown>;
};

function dateStamp(value: Date) {
  return value.toISOString().slice(0, 10);
}

function csvValue(value: unknown) {
  const text = value == null ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

const csvHeader = 'timestamp,action,alertId,alertName,level,user,details\n';

async function ensureCsvHeader(file: string) {
  try {
    await stat(file);
  } catch {
    await writeFile(file, csvHeader, 'utf8');
  }
}

function getAlertLogFilePath(now = new Date()) {
  const dir = resolve(process.cwd(), 'data', 'logs', 'alerts');
  return {
    dir,
    file: resolve(dir, `${dateStamp(now)}.csv`)
  };
}

export async function logAlertEvent(event: AlertLogEvent) {
  const timestamp = event.timestamp ?? new Date().toISOString();
  logger.info(
    {
      action: event.action,
      alertId: event.alertId,
      alertName: event.alertName,
      level: event.level,
      user: event.user,
      details: event.details
    },
    `alert ${event.action}: ${event.alertName}`
  );

  const { dir, file } = getAlertLogFilePath(new Date(timestamp));
  await mkdir(dir, { recursive: true });
  await ensureCsvHeader(file);

  const line = [
    csvValue(timestamp),
    csvValue(event.action),
    csvValue(event.alertId),
    csvValue(event.alertName),
    csvValue(event.level),
    csvValue(event.user),
    csvValue(event.details ? JSON.stringify(event.details) : '')
  ].join(',') + '\n';

  await appendFile(file, line, 'utf8');
}
