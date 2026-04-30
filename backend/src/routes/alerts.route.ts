import { Router } from 'express';
import { z } from 'zod';
import { getUnreadAlertCount, listAlerts, markAlertAsRead } from '../services/alert-service.js';

const markReadSchema = z.object({
  readBy: z.string().min(1)
});

export const alertsRouter = Router();

alertsRouter.get('/', async (_request, response, next) => {
  try {
    response.json({ alerts: await listAlerts() });
  } catch (error) {
    next(error);
  }
});

alertsRouter.get('/unread-count', async (_request, response, next) => {
  try {
    response.json({ unreadCount: await getUnreadAlertCount() });
  } catch (error) {
    next(error);
  }
});

alertsRouter.post('/:alertId/read', async (request, response, next) => {
  try {
    const parsed = markReadSchema.parse(request.body);
    const result = await markAlertAsRead(request.params.alertId, parsed.readBy);
    if (result.type === 'not_found') {
      response.status(404).json({ error: 'Alert not found' });
      return;
    }
    response.json({ alertId: result.alertId, removed: true });
  } catch (error) {
    next(error);
  }
});
