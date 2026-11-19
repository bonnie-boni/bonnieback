import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  consumePairingToken,
  createDevice,
  verifyPassword,
  getUserById,
  touchDevice,
} from '../services/auth.js';
import { config } from '../config.js';

const pairSchema = z.object({
  pairingToken: z.string().min(10),
  deviceName: z.string().min(1).max(100).default('My Phone'),
  platform: z.enum(['ios', 'android', 'unknown']).optional(),
});

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  deviceName: z.string().min(1).max(100).default('My Phone'),
  platform: z.enum(['ios', 'android', 'unknown']).optional(),
  pairingToken: z.string().optional(), // optional if already paired somehow
});

export async function authRoutes(app: FastifyInstance) {
  // Exchange pairing token + credentials → device JWT
  app.post('/pair', async (request, reply) => {
    const body = pairSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: 'Invalid payload', details: body.error.flatten() });
    }

    const { pairingToken, deviceName, platform } = body.data;
    const userId = consumePairingToken(pairingToken);

    if (!userId) {
      return reply.status(401).send({ error: 'Invalid or expired pairing token' });
    }

    // For simplicity in v1 we still require password after pairing token.
    // The mobile app will call /login right after.
    return reply.send({
      ok: true,
      message: 'Pairing token accepted. Please login with username and password.',
      userId,
    });
  });

  // Login (used after QR or for re-auth)
  app.post('/login', async (request, reply) => {
    const body = loginSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: 'Invalid payload', details: body.error.flatten() });
    }

    const { username, password, deviceName, platform, pairingToken } = body.data;

    // Optional: if a pairing token is still provided, consume it
    if (pairingToken) {
      const pairedUserId = consumePairingToken(pairingToken);
      if (!pairedUserId) {
        return reply.status(401).send({ error: 'Invalid or expired pairing token' });
      }
    }

    const user = verifyPassword(username, password);
    if (!user) {
      return reply.status(401).send({ error: 'Invalid username or password' });
    }

    const device = createDevice(user.id, deviceName, platform);

    const token = app.jwt.sign(
      {
        sub: user.id,
        deviceId: device.id,
        username: user.username,
      },
      {
        expiresIn: `${config.deviceTokenTtlDays}d`,
      }
    );

    return {
      token,
      user: { id: user.id, username: user.username },
      device: {
        id: device.id,
        name: device.name,
        platform: device.platform,
      },
    };
  });

  // Current session
  app.get('/me', {
    preHandler: [app.authenticate],
  }, async (request: any) => {
    const payload = request.user as { sub: string; deviceId: string; username: string };
    touchDevice(payload.deviceId);

    const user = getUserById(payload.sub);
    return {
      user,
      deviceId: payload.deviceId,
    };
  });
}
