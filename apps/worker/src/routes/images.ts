import { Hono } from 'hono';
import type { Env } from '../index.js';

const images = new Hono<Env>();

/**
 * POST /api/images/upload
 * Upload an image (base64) and get a permanent URL.
 * Body: { image: "base64...", filename?: "photo.jpg", contentType?: "image/jpeg" }
 * Returns: { success: true, data: { id, url, filename, contentType, sizeBytes } }
 */
images.post('/api/images/upload', async (c) => {
  try {
    const body = await c.req.json<{
      image: string;
      filename?: string;
      contentType?: string;
    }>();

    if (!body.image) {
      return c.json({ success: false, error: 'image (base64) is required' }, 400);
    }

    // Strip data URI prefix if present
    let base64 = body.image;
    let detectedType = body.contentType || 'image/jpeg';
    const dataUriMatch = base64.match(/^data:(image\/[a-z+]+);base64,(.+)$/i);
    if (dataUriMatch) {
      detectedType = dataUriMatch[1];
      base64 = dataUriMatch[2];
    }

    // Validate content type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(detectedType)) {
      return c.json({ success: false, error: `Unsupported content type: ${detectedType}` }, 400);
    }

    // Calculate size (base64 → ~75% of string length)
    const sizeBytes = Math.ceil((base64.length * 3) / 4);

    // 2MB limit for D1 storage
    const MAX_SIZE = 2 * 1024 * 1024;
    if (sizeBytes > MAX_SIZE) {
      return c.json({ success: false, error: `Image too large (${(sizeBytes / 1024 / 1024).toFixed(1)}MB). Max 2MB.` }, 400);
    }

    const id = crypto.randomUUID();
    const filename = body.filename || `image-${id.slice(0, 8)}.${detectedType.split('/')[1]?.replace('+xml', '') || 'jpg'}`;

    await c.env.DB.prepare(
      'INSERT INTO uploaded_images (id, filename, content_type, data, size_bytes) VALUES (?, ?, ?, ?, ?)'
    ).bind(id, filename, detectedType, base64, sizeBytes).run();

    const workerUrl = c.env.WORKER_URL || c.req.url.replace(/\/api\/images\/upload$/, '');
    const url = `${workerUrl}/api/images/${id}`;

    return c.json({
      success: true,
      data: { id, url, filename, contentType: detectedType, sizeBytes },
    }, 201);
  } catch (err) {
    console.error('POST /api/images/upload error:', err);
    return c.json({ success: false, error: 'Upload failed' }, 500);
  }
});

/**
 * GET /api/images/:id
 * Serve an uploaded image with proper Content-Type.
 * No auth required — images are public once uploaded.
 */
images.get('/api/images/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const row = await c.env.DB.prepare(
      'SELECT data, content_type, filename FROM uploaded_images WHERE id = ?'
    ).bind(id).first<{ data: string; content_type: string; filename: string }>();

    if (!row) {
      return c.json({ success: false, error: 'Image not found' }, 404);
    }

    // Decode base64 to binary
    const binary = Uint8Array.from(atob(row.data), (ch) => ch.charCodeAt(0));

    return new Response(binary, {
      headers: {
        'Content-Type': row.content_type,
        'Content-Disposition': `inline; filename="${row.filename}"`,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (err) {
    console.error('GET /api/images/:id error:', err);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

/**
 * GET /api/images
 * List uploaded images (metadata only, no data).
 */
images.get('/api/images', async (c) => {
  try {
    const rows = await c.env.DB.prepare(
      'SELECT id, filename, content_type, size_bytes, created_at FROM uploaded_images ORDER BY created_at DESC LIMIT 100'
    ).all<{ id: string; filename: string; content_type: string; size_bytes: number; created_at: string }>();

    const workerUrl = c.env.WORKER_URL || c.req.url.replace(/\/api\/images$/, '');

    return c.json({
      success: true,
      data: (rows.results || []).map((r) => ({
        id: r.id,
        url: `${workerUrl}/api/images/${r.id}`,
        filename: r.filename,
        contentType: r.content_type,
        sizeBytes: r.size_bytes,
        createdAt: r.created_at,
      })),
    });
  } catch (err) {
    console.error('GET /api/images error:', err);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

/**
 * DELETE /api/images/:id
 */
images.delete('/api/images/:id', async (c) => {
  try {
    await c.env.DB.prepare('DELETE FROM uploaded_images WHERE id = ?')
      .bind(c.req.param('id')).run();
    return c.json({ success: true, data: null });
  } catch (err) {
    console.error('DELETE /api/images/:id error:', err);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

export { images };
