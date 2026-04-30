import { getAlertDb, makeAlertId, type AlertLevel, type AlertRecord } from '../config/alert-store.js';
import { logAlertEvent } from '../utils/alert-logger.js';

const WINDOW_MS = 10 * 60_000;
const SINGLE_IMPORT_WINDOW_MS = 5 * 60_000;
const BATCH_IMPORT_FAILURE_THRESHOLD = 5;
const VALIDATION_FAILURE_THRESHOLD = 10;
const INVALID_MEGA_API_KEY_THRESHOLD = 5;
const SINGLE_IMPORT_FAILURE_THRESHOLD = 100;

type ThresholdRuleKey =
  | 'batch-import-failures'
  | 'validation-failed-uploads'
  | 'invalid-mega-api-key'
  | 'single-import-failures';

const recentEvents = new Map<ThresholdRuleKey, number[]>();
const lastTriggeredAt = new Map<ThresholdRuleKey, number>();

function trimRecent(ruleKey: ThresholdRuleKey, now: number) {
  const current = recentEvents.get(ruleKey) ?? [];
  const trimmed = current.filter((value) => now - value <= WINDOW_MS);
  recentEvents.set(ruleKey, trimmed);
  return trimmed;
}

async function createAlert(params: {
  name: string;
  level: AlertLevel;
  reason: string;
  details?: Record<string, unknown>;
  user?: string;
  timestamp?: string;
}) {
  const db = await getAlertDb();
  const triggeredAt = params.timestamp ?? new Date().toISOString();
  const alert: AlertRecord = {
    id: makeAlertId(),
    name: params.name,
    level: params.level,
    reason: params.reason,
    triggeredAt,
    details: params.details
  };
  db.data.alerts.unshift(alert);
  await db.write();
  await logAlertEvent({
    action: 'created',
    alertId: alert.id,
    alertName: alert.name,
    level: alert.level,
    user: params.user ?? 'system',
    timestamp: triggeredAt,
    details: alert.details
  });
  return alert;
}

async function recordThresholdEvent(params: {
  ruleKey: ThresholdRuleKey;
  threshold: number;
  alertName: string;
  reason: string;
  details?: Record<string, unknown>;
}) {
  const now = Date.now();
  const timestamps = trimRecent(params.ruleKey, now);
  timestamps.push(now);
  recentEvents.set(params.ruleKey, timestamps);

  const lastTriggered = lastTriggeredAt.get(params.ruleKey) ?? 0;
  if (timestamps.length < params.threshold || now - lastTriggered < WINDOW_MS) {
    return null;
  }

  lastTriggeredAt.set(params.ruleKey, now);
  return createAlert({
    name: params.alertName,
    level: 'alert',
    reason: params.reason,
    details: params.details
  });
}

export async function recordBatchImportFailure(params: {
  source: 'batch' | 'mega';
  reason: string;
}) {
  return recordThresholdEvent({
    ruleKey: 'batch-import-failures',
    threshold: BATCH_IMPORT_FAILURE_THRESHOLD,
    alertName: 'Repeated Batch Import Failures',
    reason: `Batch imports failed ${BATCH_IMPORT_FAILURE_THRESHOLD} times in 10 minutes.`,
    details: {
      source: params.source,
      latestReason: params.reason,
      threshold: BATCH_IMPORT_FAILURE_THRESHOLD,
      windowMinutes: 10
    }
  });
}

export async function recordValidationFailedUpload(params: {
  source: 'batch' | 'mega';
  issueCount: number;
}) {
  return recordThresholdEvent({
    ruleKey: 'validation-failed-uploads',
    threshold: VALIDATION_FAILURE_THRESHOLD,
    alertName: 'Repeated Validation Failed Uploads',
    reason: `Validation failed uploads reached ${VALIDATION_FAILURE_THRESHOLD} times in 10 minutes.`,
    details: {
      source: params.source,
      latestIssueCount: params.issueCount,
      threshold: VALIDATION_FAILURE_THRESHOLD,
      windowMinutes: 10
    }
  });
}

export async function recordInvalidMegaApiKeyAttempt(params: { ip: string }) {
  return recordThresholdEvent({
    ruleKey: 'invalid-mega-api-key',
    threshold: INVALID_MEGA_API_KEY_THRESHOLD,
    alertName: 'Repeated Invalid Mega API Key Attempts',
    reason: `Invalid x-api-key attempts on /api/parcels/mega reached ${INVALID_MEGA_API_KEY_THRESHOLD} times in 10 minutes.`,
    details: {
      ip: params.ip,
      threshold: INVALID_MEGA_API_KEY_THRESHOLD,
      windowMinutes: 10
    }
  });
}

export async function recordSingleImportFailure(params: { reason: string }) {
  const ruleKey: ThresholdRuleKey = 'single-import-failures';
  const now = Date.now();
  const current = recentEvents.get(ruleKey) ?? [];
  const trimmed = current.filter(
    (value) => now - value <= SINGLE_IMPORT_WINDOW_MS,
  );
  trimmed.push(now);
  recentEvents.set(ruleKey, trimmed);

  const lastTriggered = lastTriggeredAt.get(ruleKey) ?? 0;
  if (
    trimmed.length < SINGLE_IMPORT_FAILURE_THRESHOLD ||
    now - lastTriggered < SINGLE_IMPORT_WINDOW_MS
  ) {
    return null;
  }

  lastTriggeredAt.set(ruleKey, now);
  return createAlert({
    name: 'Repeated Single Import Failures',
    level: 'alert',
    reason: `Single imports failed ${SINGLE_IMPORT_FAILURE_THRESHOLD} times in 5 minutes.`,
    details: {
      latestReason: params.reason,
      threshold: SINGLE_IMPORT_FAILURE_THRESHOLD,
      windowMinutes: 5
    }
  });
}

export async function recordConfigChangeInfo(params: {
  section: 'approval' | 'route';
  actor: string;
  action: 'created' | 'updated' | 'deleted' | 'changed';
  count: number;
}) {
  const sectionLabel = params.section === 'approval' ? 'Approval' : 'Routing';
  const actionLabel = {
    created: 'Added',
    updated: 'Updated',
    deleted: 'Deleted',
    changed: 'Changed'
  }[params.action];

  return createAlert({
    name: `${sectionLabel} Rule ${actionLabel}`,
    level: 'info',
    reason: `${sectionLabel} rule configuration was ${params.action === 'created' ? 'added' : params.action === 'updated' ? 'updated' : params.action === 'deleted' ? 'deleted' : 'changed'}.`,
    details: {
      section: params.section,
      action: params.action
    },
    user: params.actor
  });
}

export async function listAlerts() {
  const db = await getAlertDb();
  return [...db.data.alerts].sort((left, right) =>
    right.triggeredAt.localeCompare(left.triggeredAt),
  );
}

export async function getUnreadAlertCount() {
  const db = await getAlertDb();
  return db.data.alerts.length;
}

export async function markAlertAsRead(alertId: string, readBy: string) {
  const db = await getAlertDb();
  const alertIndex = db.data.alerts.findIndex((current) => current.id === alertId);
  const alert = alertIndex >= 0 ? db.data.alerts[alertIndex] : undefined;
  if (!alert) return { type: 'not_found' as const };

  const readAt = new Date().toISOString();
  db.data.alerts.splice(alertIndex, 1);
  await db.write();
  await logAlertEvent({
    action: 'read',
    alertId: alert.id,
    alertName: alert.name,
    level: alert.level,
    user: readBy,
    timestamp: readAt,
    details: {
      result: 'removed_from_demo_store'
    }
  });

  return { type: 'ok' as const, alertId };
}
