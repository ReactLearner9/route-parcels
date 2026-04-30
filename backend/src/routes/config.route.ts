import { Router } from 'express';
import { upload } from '../middleware/upload.js';
import {
  applyUploadedApprovalConfig,
  applyUploadedRoutingConfig,
  getConfigState,
  validateUploadedApprovalConfig,
  validateUploadedRoutingConfig,
} from '../services/config-service.js';

export const configRouter = Router();

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

    response.json(await validateUploadedApprovalConfig(request.file));
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

    response.json(await validateUploadedRoutingConfig(request.file));
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

    const sessionId = typeof request.headers['x-session-id'] === 'string' ? request.headers['x-session-id'] : 'backend';
    const result = await applyUploadedApprovalConfig(request.file, request.body?.modifiedBy, sessionId);
    response.json({
      applied: true,
      checksum: result.checksum
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

    const sessionId = typeof request.headers['x-session-id'] === 'string' ? request.headers['x-session-id'] : 'backend';
    const result = await applyUploadedRoutingConfig(request.file, request.body?.modifiedBy, sessionId);

    response.json({
      applied: true,
      checksum: result.checksum
    });
  } catch (error) {
    next(error);
  }
});
