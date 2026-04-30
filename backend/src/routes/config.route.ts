import { Router } from 'express';
import { upload } from '../middleware/upload.js';
import {
  applyUploadedApprovalConfig,
  applyUploadedRoutingConfig,
  getConfigState,
  validateUploadedApprovalConfig,
  validateUploadedRoutingConfig,
} from '../services/config-service.js';
import { logAuditEvent } from '../utils/audit-logger.js';

export const configRouter = Router();

function readSessionId(headers: Record<string, unknown>) {
  return typeof headers['x-session-id'] === 'string' ? headers['x-session-id'] : 'backend';
}

function normalizeActor(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : 'system';
}

function countConfigRules(file: Express.Multer.File) {
  try {
    const parsed = JSON.parse(file.buffer.toString('utf8')) as { rules?: unknown[] };
    return Array.isArray(parsed.rules) ? parsed.rules.length : 0;
  } catch {
    return 0;
  }
}

function getConfigIdentifiers(section: 'approval' | 'route', file: Express.Multer.File) {
  try {
    const parsed = JSON.parse(file.buffer.toString('utf8')) as { rules?: Array<{ action?: { approval?: string; department?: string } }> };
    const rules = Array.isArray(parsed.rules) ? parsed.rules : [];
    return section === 'approval'
      ? { approvalNames: rules.map((rule) => rule.action?.approval).filter((value): value is string => Boolean(value)) }
      : { departments: rules.map((rule) => rule.action?.department).filter((value): value is string => Boolean(value)) };
  } catch {
    return section === 'approval' ? { approvalNames: [] as string[] } : { departments: [] as string[] };
  }
}

async function logConfigValidation(
  section: 'approval' | 'route',
  file: Express.Multer.File,
  actor: string,
  sessionId: string,
  report: { valid: boolean; issues: Array<{ rowNo: number }> }
) {
  const ruleCount = countConfigRules(file);
  const failedCount = report.valid ? 0 : new Set(report.issues.map((issue) => issue.rowNo)).size;

  await logAuditEvent({
    user: actor,
    sessionId,
    screen: 'Config',
    functionality: `${section}_rule_validate`,
    feature: 'config',
    status: report.valid ? 'passed' : 'failed',
    details: {
      section,
      count: ruleCount,
      failedCount,
      passedCount: Math.max(0, ruleCount - failedCount),
      ...getConfigIdentifiers(section, file)
    }
  });
}

configRouter.get('/', async (_request, response, next) => {
  try {
    response.json(await getConfigState());
  } catch (error) {
    next(error);
  }
});

configRouter.post('/approval/validate', upload.single('configFile'), async (request, response, next) => {
  try {
    if (!request.file) {
      response.status(400).json({ error: 'configFile is required' });
      return;
    }

    const sessionId = readSessionId(request.headers as Record<string, unknown>);
    const actor = normalizeActor(request.body?.modifiedBy);
    const report = await validateUploadedApprovalConfig(request.file);
    await logConfigValidation('approval', request.file, actor, sessionId, report);
    response.json(report);
  } catch (error) {
    next(error);
  }
});

configRouter.post('/routing/validate', upload.single('configFile'), async (request, response, next) => {
  try {
    if (!request.file) {
      response.status(400).json({ error: 'configFile is required' });
      return;
    }

    const sessionId = readSessionId(request.headers as Record<string, unknown>);
    const actor = normalizeActor(request.body?.modifiedBy);
    const report = await validateUploadedRoutingConfig(request.file);
    await logConfigValidation('route', request.file, actor, sessionId, report);
    response.json(report);
  } catch (error) {
    next(error);
  }
});

configRouter.post('/approval/apply', upload.single('configFile'), async (request, response, next) => {
  try {
    if (!request.file) {
      response.status(400).json({ error: 'configFile is required' });
      return;
    }

    const sessionId = readSessionId(request.headers as Record<string, unknown>);
    await applyUploadedApprovalConfig(request.file, request.body?.modifiedBy, sessionId);
    response.json({
      applied: true
    });
  } catch (error) {
    next(error);
  }
});

configRouter.post('/routing/apply', upload.single('configFile'), async (request, response, next) => {
  try {
    if (!request.file) {
      response.status(400).json({ error: 'configFile is required' });
      return;
    }

    const sessionId = readSessionId(request.headers as Record<string, unknown>);
    await applyUploadedRoutingConfig(request.file, request.body?.modifiedBy, sessionId);

    response.json({
      applied: true
    });
  } catch (error) {
    next(error);
  }
});
