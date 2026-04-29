import { Router } from 'express';
import { z } from 'zod';
import { logAuditEvent } from '../utils/audit-logger.js';

const logEventSchema = z.object({
  user: z.string().min(1),
  sessionId: z.string().min(1),
  screen: z.string().min(1),
  functionality: z.string().min(1),
  feature: z.enum(['single-import', 'batch-import', 'analytics', 'config', 'seed']),
  phase: z.enum(['started', 'ended']),
  status: z.enum(['passed', 'failed', 'success', 'not_found', 'found']).optional(),
  timestamp: z.string().datetime().optional(),
  durationMs: z.number().nonnegative().optional(),
  details: z.record(z.string(), z.unknown()).optional()
});

export const logsRouter = Router();

logsRouter.post('/events', async (request, response, next) => {
  try {
    const parsed = logEventSchema.parse(request.body);
    await logAuditEvent(parsed);
    response.status(202).json({ accepted: true });
  } catch (error) {
    next(error);
  }
});
