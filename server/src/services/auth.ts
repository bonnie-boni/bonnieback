import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import { config } from '../config.js';

export interface User {
  id: string;
  username: string;
}

export interface Device {
  id: string;
  user_id: string;
  name: string;
  platform: string | null;
  last_seen_at: string | null;
  created_at: string;
  revoked_at: string | null;
}

export function findUserByUsername(username: string): User | undefined {
  return db.prepare('SELECT id, username FROM users WHERE username = ?').get(username) as User | undefined;
}

export function verifyPassword(username: string, password: string): User | null {
  const row = db.prepare('SELECT id, username, password_hash FROM users WHERE username = ?').get(username) as
    | { id: string; username: string; password_hash: string }
    | undefined;

  if (!row) return null;
  if (!bcrypt.compareSync(password, row.password_hash)) return null;
  return { id: row.id, username: row.username };
}

export function createPairingToken(userId: string): string {
  const token = uuidv4() + uuidv4().replace(/-/g, '');
  const expiresAt = new Date(Date.now() + config.pairingTokenTtlSeconds * 1000).toISOString();

  db.prepare(
    `INSERT INTO pairing_tokens (token, user_id, expires_at) VALUES (?, ?, ?)`
  ).run(token, userId, expiresAt);

  return token;
}

export function consumePairingToken(token: string): string | null {
  const row = db.prepare(
    `SELECT user_id, expires_at, used_at FROM pairing_tokens WHERE token = ?`
  ).get(token) as { user_id: string; expires_at: string; used_at: string | null } | undefined;

  if (!row) return null;
  if (row.used_at) return null;
  if (new Date(row.expires_at) < new Date()) return null;

  db.prepare(`UPDATE pairing_tokens SET used_at = datetime('now') WHERE token = ?`).run(token);
  return row.user_id;
}

export function createDevice(userId: string, name: string, platform?: string): Device {
  const id = uuidv4();
  db.prepare(
    `INSERT INTO devices (id, user_id, name, platform, last_seen_at) VALUES (?, ?, ?, ?, datetime('now'))`
  ).run(id, userId, name, platform || null);

  return db.prepare('SELECT * FROM devices WHERE id = ?').get(id) as Device;
}

export function getDevice(deviceId: string): Device | undefined {
  return db.prepare('SELECT * FROM devices WHERE id = ? AND revoked_at IS NULL').get(deviceId) as Device | undefined;
}

export function listDevices(userId: string): Device[] {
  return db.prepare(
    `SELECT * FROM devices WHERE user_id = ? ORDER BY created_at DESC`
  ).all(userId) as Device[];
}

export function revokeDevice(deviceId: string): boolean {
  const result = db.prepare(
    `UPDATE devices SET revoked_at = datetime('now') WHERE id = ? AND revoked_at IS NULL`
  ).run(deviceId);
  return result.changes > 0;
}

export function touchDevice(deviceId: string) {
  db.prepare(`UPDATE devices SET last_seen_at = datetime('now') WHERE id = ?`).run(deviceId);
}

export function getUserById(userId: string): User | undefined {
  return db.prepare('SELECT id, username FROM users WHERE id = ?').get(userId) as User | undefined;
}
