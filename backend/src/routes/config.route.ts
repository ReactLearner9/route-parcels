import { Router } from 'express';
import { upload } from '../middleware/upload.js';
import { applyUploadedConfig, getConfigState, validateUploadedConfig } from '../services/config-service.js';
import { getCurrentConfig } from '../config/store.js';

export const configRouter = Router();

configRouter.get('/', async (_request, response, next) => {
  try {
    const [state, current] = await Promise.all([getConfigState(), getCurrentConfig()]);
    response.json({
      ...state,
      currentConfig: current?.config ?? null
    });
  } catch (error) {
    next(error);
  }
});

configRouter.post('/validate', upload.single('configFile'), async (request, response, next) => {
  try {
    if (!request.file) {
      response.status(400).json({ error: 'configFile is required' });
      return;
    }

    const result = await validateUploadedConfig(request.file);

    response.json({
      valid: true,
      checksum: result.checksum,
      filename: result.filename,
      rules: result.rules
    });
  } catch (error) {
    next(error);
  }
});

configRouter.post('/apply', upload.single('configFile'), async (request, response, next) => {
  try {
    if (!request.file) {
      response.status(400).json({ error: 'configFile is required' });
      return;
    }

    const version = await applyUploadedConfig(request.file);

    response.json({
      applied: true,
      version: version.version,
      checksum: version.checksum
    });
  } catch (error) {
    next(error);
  }
});
