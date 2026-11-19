import { FastifyInstance } from 'fastify';
import { listRecentMedia, getStorageStats } from '../services/storage.js';

export async function mediaRoutes(app: FastifyInstance) {
  app.get('/media/recent', {
    preHandler: [app.authenticate],
  }, async (request: any) => {
    const userId = request.user.sub as string;
    const limit = Math.min(parseInt((request.query as any).limit || '20', 10), 100);
    const items = listRecentMedia(userId, limit);
    return { items };
  });

  app.get('/stats', {
    preHandler: [app.authenticate],
  }, async (request: any) => {
    const userId = request.user.sub as string;
    return getStorageStats(userId);
  });
}
