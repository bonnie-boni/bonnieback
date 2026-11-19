import { FastifyInstance } from 'fastify';
import { listDevices, revokeDevice } from '../services/auth.js';

export async function deviceRoutes(app: FastifyInstance) {
  app.get('/devices', {
    preHandler: [app.authenticate],
  }, async (request: any) => {
    const userId = request.user.sub as string;
    const devices = listDevices(userId);
    return { devices };
  });

  app.delete('/devices/:id', {
    preHandler: [app.authenticate],
  }, async (request: any, reply) => {
    const userId = request.user.sub as string;
    const deviceId = (request.params as any).id;

    // Only allow revoking own devices
    const devices = listDevices(userId);
    const target = devices.find((d) => d.id === deviceId);
    if (!target) {
      return reply.status(404).send({ error: 'Device not found' });
    }

    const ok = revokeDevice(deviceId);
    return { ok };
  });
}
