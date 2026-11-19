import fs from 'node:fs';
import https from 'node:https';
import http from 'node:http';
import Fastify from 'fastify';

// Server TLS (self-signed or real cert). Set via env or auto-generated.
let httpsKey: string | undefined;
let httpsCert: string | undefined;
let httpsCa: string | undefined;
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import { config } from './config.js';
import { ensureBackupRoot } from './services/storage.js';
import { authRoutes } from './routes/auth.js';
import { uploadRoutes } from './routes/upload.js';
import { mediaRoutes } from './routes/media.js';
import { deviceRoutes } from './routes/devices.js';

ensureBackupRoot();

const app = Fastify({
  logger: true,
  bodyLimit: 100 * 1024 * 1024, // 100 MB for non-multipart
  serverFactory: (handler, opts) => {
    // opts contains { port, host } from app.listen({ port, host }).
    // Build an HTTPS server if key/cert are provided, otherwise plain HTTP.
    if (httpsKey && httpsCert) {
      return https.createServer(
        { key: httpsKey, cert: httpsCert, ca: config.httpsCa || undefined },
        handler,
      );
    }
    return http.createServer(handler);
  },
});

await app.register(cors, { origin: true });
await app.register(jwt, { secret: config.jwtSecret });
await app.register(multipart, {
  limits: {
    fileSize: 2 * 1024 * 1024 * 1024, // 2 GB
  },
});

// Auth decorator
app.decorate('authenticate', async function (request: any, reply: any) {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.status(401).send({ error: 'Unauthorized' });
  }
});

// Health
app.get('/health', async () => ({ status: 'ok', time: new Date().toISOString() }));

// Routes
await app.register(authRoutes, { prefix: '/api' });
await app.register(uploadRoutes, { prefix: '/api' });
await app.register(mediaRoutes, { prefix: '/api' });
await app.register(deviceRoutes, { prefix: '/api' });

const start = async () => {
  try {
    let httpsKey: string | undefined;
    let httpsCert: string | undefined;

    if (config.https) {
      if (config.httpsKey && config.httpsCert) {
        httpsKey = config.httpsKey;
        httpsCert = config.httpsCert;
      } else {
        // Auto-generate a self-signed certificate for local HTTPS.
        console.log('Generating a self-signed certificate for HTTPS...');
        const { execFileSync } = await import('node:child_process');
        try {
          execFileSync('openssl', [
            'req', '-x509', '-nodes', '-newkey', 'rsa:2048',
            '-keyout', 'server.key', '-out', 'server.crt',
            '-days', '365', '-subj', '/CN=localhost',
            '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1',
          ], { stdio: 'ignore' });
          httpsKey = fs.readFileSync('server.key', 'utf8');
          httpsCert = fs.readFileSync('server.crt', 'utf8');
          console.log('  Self-signed certificate generated.');
        } catch (err) {
          app.log.error(
            'HTTPS requested but openssl is not available; falling back to HTTP.',
          );
          config.https = false;
          if (fs.existsSync('server.key')) fs.rmSync('server.key', { force: true });
          if (fs.existsSync('server.crt')) fs.rmSync('server.crt', { force: true });
        }
      }
    }

    if (httpsKey && httpsCert) {
      // The serverFactory (defined above) reads these at listen() time.
      // No-op here; the values are already in scope from module-level
      // declarations. The factory uses them at app.listen() time.
    }

    await app.listen({ port: config.port, host: config.host });
    console.log(`\n✓ LocalCloud server running at https://${config.host}:${config.port}`);
    console.log(`  Backup root: ${config.backupRoot}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
