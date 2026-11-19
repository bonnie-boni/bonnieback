import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import { config } from '../config.js';

export interface MediaRecord {
  id: string;
  user_id: string;
  device_id: string | null;
  content_hash: string;
  original_name: string;
  original_path: string | null;
  mime_type: string | null;
  size_bytes: number;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
  taken_at: string | null;
  uploaded_at: string;
  storage_path: string;
}

export function ensureBackupRoot() {
  if (!fs.existsSync(config.backupRoot)) {
    fs.mkdirSync(config.backupRoot, { recursive: true });
  }
}

export function hashExists(userId: string, contentHash: string): boolean {
  const row = db.prepare(
    `SELECT 1 FROM media WHERE user_id = ? AND content_hash = ?`
  ).get(userId, contentHash);
  return !!row;
}

export function checkHashes(userId: string, hashes: string[]): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  const stmt = db.prepare(`SELECT content_hash FROM media WHERE user_id = ? AND content_hash = ?`);

  for (const hash of hashes) {
    result[hash] = !!stmt.get(userId, hash);
  }
  return result;
}

export function getStoragePathForHash(contentHash: string, originalName: string): string {
  const now = new Date();
  const year = now.getFullYear().toString();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  const ext = path.extname(originalName) || '';
  const dir = path.join(config.backupRoot, year, month, day);
  fs.mkdirSync(dir, { recursive: true });

  return path.join(year, month, day, `${contentHash}${ext}`);
}

export function saveMediaFile(
  userId: string,
  deviceId: string | null,
  tempFilePath: string,
  meta: {
    contentHash: string;
    originalName: string;
    originalPath?: string;
    mimeType?: string;
    sizeBytes: number;
    width?: number;
    height?: number;
    durationMs?: number;
    takenAt?: string;
  }
): MediaRecord {
  // Dedup check
  if (hashExists(userId, meta.contentHash)) {
    // Clean temp file
    try { fs.unlinkSync(tempFilePath); } catch {}
    const existing = db.prepare(
      `SELECT * FROM media WHERE user_id = ? AND content_hash = ?`
    ).get(userId, meta.contentHash) as MediaRecord;
    return existing;
  }

  const relativePath = getStoragePathForHash(meta.contentHash, meta.originalName);
  const absolutePath = path.join(config.backupRoot, relativePath);

  // Move / copy the file into final location
  fs.renameSync(tempFilePath, absolutePath);

  const id = uuidv4();
  db.prepare(
    `INSERT INTO media (
      id, user_id, device_id, content_hash, original_name, original_path,
      mime_type, size_bytes, width, height, duration_ms, taken_at, storage_path
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    userId,
    deviceId,
    meta.contentHash,
    meta.originalName,
    meta.originalPath || null,
    meta.mimeType || null,
    meta.sizeBytes,
    meta.width || null,
    meta.height || null,
    meta.durationMs || null,
    meta.takenAt || null,
    relativePath
  );

  return db.prepare('SELECT * FROM media WHERE id = ?').get(id) as MediaRecord;
}

export function listRecentMedia(userId: string, limit = 20): MediaRecord[] {
  return db.prepare(
    `SELECT * FROM media WHERE user_id = ? ORDER BY uploaded_at DESC LIMIT ?`
  ).all(userId, limit) as MediaRecord[];
}

export function getStorageStats(userId: string) {
  const row = db.prepare(
    `SELECT COUNT(*) as file_count, COALESCE(SUM(size_bytes), 0) as total_bytes
     FROM media WHERE user_id = ?`
  ).get(userId) as { file_count: number; total_bytes: number };

  return {
    fileCount: row.file_count,
    totalBytes: row.total_bytes,
    totalMB: Math.round((row.total_bytes / 1024 / 1024) * 100) / 100,
  };
}

export function computeFileHash(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (data) => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}
