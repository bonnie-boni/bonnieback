import { FastifyInstance } from 'fastify';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { z } from 'zod';
import { checkHashes, saveMediaFile, computeFileHash } from '../services/storage.js';
import { config } from '../config.js';
import { v4 as uuidv4 } from 'uuid';

const checkSchema = z.object({
  hashes: z.array(z.string().length(64)).min(1).max(200),
});

export async function uploadRoutes(app: FastifyInstance) {
  // Batch check which hashes the server already has
  app.post('/uploads/check', {
    preHandler: [app.authenticate],
  }, async (request: any, reply) => {
    const body = checkSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: 'Invalid payload' });
    }

    const userId = request.user.sub as string;
    const existing = checkHashes(userId, body.data.hashes);
    return { existing };
  });

  // Simple single-file upload (good enough for v1, can be upgraded to tus later)
  app.post('/uploads', {
    preHandler: [app.authenticate],
  }, async (request: any, reply) => {
    const userId = request.user.sub as string;
    const deviceId = request.user.deviceId as string;

    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ error: 'No file uploaded' });
    }

    const originalName = data.filename || 'unknown';
    const mimeType = data.mimetype;
    const tmpPath = path.join(config.backupRoot, `.tmp-${uuidv4()}`);

    try {
      await pipeline(data.file, fs.createWriteStream(tmpPath));
    } catch (err) {
      try { fs.unlinkSync(tmpPath); } catch {}
      return reply.status(500).send({ error: 'Failed to write temp file' });
    }

    const stats = fs.statSync(tmpPath);
    const contentHash = await computeFileHash(tmpPath);

    // Extra metadata from fields if provided
    const fields = data.fields as Record<string, any>;
    const originalPath = fields?.originalPath?.value;
    const takenAt = fields?.takenAt?.value;
    const width = fields?.width?.value ? parseInt(fields.width.value, 10) : undefined;
    const height = fields?.height?.value ? parseInt(fields.height.value, 10) : undefined;
    const durationMs = fields?.durationMs?.value ? parseInt(fields.durationMs.value, 10) : undefined;

    const record = saveMediaFile(userId, deviceId, tmpPath, {
      contentHash,
      originalName,
      originalPath,
      mimeType,
      sizeBytes: stats.size,
      width,
      height,
      durationMs,
      takenAt,
    });

    return {
      ok: true,
      media: {
        id: record.id,
        contentHash: record.content_hash,
        originalName: record.original_name,
        sizeBytes: record.size_bytes,
        uploadedAt: record.uploaded_at,
      },
    };
  });
}
