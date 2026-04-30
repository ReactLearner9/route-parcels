import { Router } from 'express';
import { resetAndSeedBackend, seedConfigDataOnly, seedParcelAndBatchDataOnly } from '../services/seed-service.js';
import { logAuditEvent } from '../utils/audit-logger.js';

export const seedRouter = Router();

function readSessionId(headers: Record<string, unknown>) {
  return typeof headers['x-session-id'] === 'string' ? headers['x-session-id'] : 'backend';
}

function normalizeActor(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : 'system';
}

seedRouter.post('/', async (request, response, next) => {
  try {
    const action = request.body?.action ?? 'all';
    const sessionId = readSessionId(request.headers as Record<string, unknown>);
    const actor = normalizeActor(request.body?.seededBy ?? request.body?.modifiedBy ?? request.body?.importedBy);

    if (action === 'parcels' || action === 'batch') {
      const result = await seedParcelAndBatchDataOnly();
      await logAuditEvent({
        user: actor,
        sessionId,
        screen: 'Seed',
        functionality: 'seed_execute',
        feature: 'seed',
        status: 'success',
        details: {
          seedType: 'parcel'
        }
      });
      response.json(result);
      return;
    }
    if (action === 'config') {
      const result = await seedConfigDataOnly();
      await logAuditEvent({
        user: actor,
        sessionId,
        screen: 'Seed',
        functionality: 'seed_execute',
        feature: 'seed',
        status: 'success',
        details: {
          seedType: 'config'
        }
      });
      response.json(result);
      return;
    }
    const result = await resetAndSeedBackend();
    await logAuditEvent({
      user: actor,
      sessionId,
      screen: 'Seed',
      functionality: 'seed_execute',
      feature: 'seed',
      status: 'success',
      details: {
        seedType: 'parcel'
      }
    });
    response.json(result);
  } catch (error) {
    next(error);
  }
});
