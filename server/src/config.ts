import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const config = {
  port: parseInt(process.env.PORT || '3847', 10),
  host: process.env.HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV || 'development',

  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me-in-production',
  pairingTokenTtlSeconds: parseInt(process.env.PAIRING_TOKEN_TTL_SECONDS || '600', 10),
  deviceTokenTtlDays: parseInt(process.env.DEVICE_TOKEN_TTL_DAYS || '365', 10),

  adminUsername: process.env.ADMIN_USERNAME || 'admin',
  adminPassword: process.env.ADMIN_PASSWORD || 'change-me',

  backupRoot: path.resolve(process.env.BACKUP_ROOT || path.join(__dirname, '../../data/backups')),
  databasePath: path.resolve(process.env.DATABASE_PATH || path.join(__dirname, '../../data/media.db')),

  cloudflareTunnelToken: process.env.CLOUDFLARE_TUNNEL_TOKEN || '',

  // Optional HTTPS (self-signed or real cert). Leave both empty for plain HTTP.
  httpsKey: process.env.HTTPS_KEY || '',
  httpsCert: process.env.HTTPS_CERT || '',
  httpsCa: process.env.HTTPS_CA || '',

  // If true (or if httpsKey/cert are auto-generated), the server serves
  // HTTPS on the same port with a self-signed certificate.
  https: process.env.HTTPS === '1' || !!process.env.HTTPS_KEY || !!process.env.HTTPS_CERT,
};
