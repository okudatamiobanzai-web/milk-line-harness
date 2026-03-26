/**
 * milk ops API routes
 * - POST /api/ops/report — submit task/order from LIFF (public, no auth)
 * - GET /api/ops/reports — list task reports (for dashboard)
 * - GET /api/ops/orders — list orders with status (for dashboard)
 * - GET /api/ops/summary — aggregated stats
 */

import { Hono } from 'hono';
import { jstNow, getFriendByLineUserId } from '@line-crm/db';
import { LineClient } from '@line-crm/line-sdk';
import { buildMessage } from '../services/step-delivery.js';
import {
  RYUTARO_LINE_ID,
  OPS_CATEGORIES,
  getSubLabels,
  buildCompleteFlex,
  buildTaskNotifyFlex,
  buildOrderNotifyFlex,
  URGENCY_OPTIONS,
} from '../services/ops.js';
import type { Env } from '../index.js';

const ops = new Hono<Env>();

// POST /api/ops/report — LIFF submission (public endpoint)
ops.post('/api/ops/report', async (c) => {
  try {
    const db = c.env.DB;
    const body = await c.req.json<{
      lineUserId: string;
      type: 'task' | 'order';
      category?: string;
      subItems?: string[];
      items?: string[];
      urgency?: string;
    }>();

    if (!body.lineUserId) {
      return c.json({ success: false, error: 'lineUserId required' }, 400);
    }

    const friend = await getFriendByLineUserId(db, body.lineUserId);
    if (!friend) {
      return c.json({ success: false, error: 'Friend not found' }, 404);
    }

    const lineClient = new LineClient(c.env.LINE_CHANNEL_ACCESS_TOKEN);
    const now = jstNow();

    if (body.type === 'task') {
      const catKey = body.category || '';
      const subItems = body.subItems || [];
      if (!catKey || subItems.length === 0) {
        return c.json({ success: false, error: 'category and subItems required' }, 400);
      }

      // Save report
      await db.prepare(
        'INSERT INTO ops_reports (id, friend_id, category, sub_items, created_at) VALUES (?, ?, ?, ?, ?)'
      ).bind(crypto.randomUUID(), friend.id, catKey, JSON.stringify(subItems), now).run();

      // Send completion Flex to user
      const completeFlex = buildCompleteFlex(friend.display_name, catKey, subItems);
      await lineClient.pushMessage(friend.line_user_id, [
        buildMessage('flex', JSON.stringify(completeFlex)),
      ]);

      // Notify Ryutaro
      const notifyFlex = buildTaskNotifyFlex(friend.display_name, catKey, subItems);
      await lineClient.pushMessage(RYUTARO_LINE_ID, [
        buildMessage('flex', JSON.stringify(notifyFlex)),
      ]);

      return c.json({ success: true });
    }

    if (body.type === 'order') {
      const items = body.items || [];
      const urgency = body.urgency || 'low';
      if (items.length === 0) {
        return c.json({ success: false, error: 'items required' }, 400);
      }

      // Save each order
      const orderIds: string[] = [];
      for (const item of items) {
        const oid = crypto.randomUUID();
        orderIds.push(oid);
        await db.prepare(
          'INSERT INTO ops_orders (id, friend_id, item_name, urgency, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).bind(oid, friend.id, item, urgency, 'pending', now, now).run();
      }

      // Notify Ryutaro for each item
      for (let i = 0; i < items.length; i++) {
        const notifyFlex = buildOrderNotifyFlex(
          friend.display_name, items[i], urgency, orderIds[i], friend.id,
        );
        await lineClient.pushMessage(RYUTARO_LINE_ID, [
          buildMessage('flex', JSON.stringify(notifyFlex)),
        ]);
      }

      // Confirm to user
      const urg = URGENCY_OPTIONS.find(u => u.key === urgency);
      const confirmText = `📦 ${items.join('、')} の発注依頼を送りました！\n緊急度: ${urg ? `${urg.emoji} ${urg.label}` : urgency}\n⏳ 承認待ち`;
      await lineClient.pushMessage(friend.line_user_id, [
        { type: 'text', text: confirmText },
      ]);

      return c.json({ success: true });
    }

    return c.json({ success: false, error: 'Invalid type' }, 400);
  } catch (err) {
    console.error('POST /api/ops/report error:', err);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// GET /api/ops/reports — list task reports
ops.get('/api/ops/reports', async (c) => {
  try {
    const period = c.req.query('period') || 'week'; // today, week, month
    const db = c.env.DB;

    let since: string;
    const now = new Date(Date.now() + 9 * 3600_000);
    if (period === 'today') {
      since = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    } else if (period === 'month') {
      since = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    } else {
      // week
      const weekAgo = new Date(now.getTime() - 7 * 24 * 3600_000);
      since = weekAgo.toISOString();
    }

    const results = await db.prepare(`
      SELECT r.id, r.category, r.sub_items, r.created_at,
             f.display_name, f.picture_url
      FROM ops_reports r
      LEFT JOIN friends f ON r.friend_id = f.id
      WHERE r.created_at >= ?
      ORDER BY r.created_at DESC
      LIMIT 200
    `).bind(since).all();

    return c.json({
      success: true,
      data: results.results.map((r: Record<string, unknown>) => ({
        id: r.id,
        category: r.category,
        subItems: JSON.parse((r.sub_items as string) || '[]'),
        displayName: r.display_name,
        pictureUrl: r.picture_url,
        createdAt: r.created_at,
      })),
    });
  } catch (err) {
    console.error('GET /api/ops/reports error:', err);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// GET /api/ops/orders — list orders with status
ops.get('/api/ops/orders', async (c) => {
  try {
    const status = c.req.query('status'); // pending, approved, rejected, etc.
    const db = c.env.DB;

    let query = `
      SELECT o.*, f.display_name, f.picture_url
      FROM ops_orders o
      LEFT JOIN friends f ON o.friend_id = f.id
    `;
    const binds: string[] = [];

    if (status) {
      query += ' WHERE o.status = ?';
      binds.push(status);
    }
    query += ' ORDER BY o.created_at DESC LIMIT 100';

    const stmt = db.prepare(query);
    const results = binds.length > 0
      ? await stmt.bind(...binds).all()
      : await stmt.all();

    return c.json({ success: true, data: results.results });
  } catch (err) {
    console.error('GET /api/ops/orders error:', err);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// GET /api/ops/summary — aggregated stats for dashboard
ops.get('/api/ops/summary', async (c) => {
  try {
    const period = c.req.query('period') || 'week';
    const db = c.env.DB;

    const now = new Date(Date.now() + 9 * 3600_000);
    let since: string;
    if (period === 'today') {
      since = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    } else if (period === 'month') {
      since = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    } else {
      since = new Date(now.getTime() - 7 * 24 * 3600_000).toISOString();
    }

    // Total reports
    const totalReports = await db.prepare(
      'SELECT COUNT(*) as count FROM ops_reports WHERE created_at >= ?'
    ).bind(since).first<{ count: number }>();

    // Unique participants
    const participants = await db.prepare(
      'SELECT COUNT(DISTINCT friend_id) as count FROM ops_reports WHERE created_at >= ?'
    ).bind(since).first<{ count: number }>();

    // By category
    const byCategory = await db.prepare(`
      SELECT category, COUNT(*) as count
      FROM ops_reports WHERE created_at >= ?
      GROUP BY category ORDER BY count DESC
    `).bind(since).all();

    // Pending orders
    const pendingOrders = await db.prepare(
      "SELECT COUNT(*) as count FROM ops_orders WHERE status = 'pending'"
    ).first<{ count: number }>();

    return c.json({
      success: true,
      data: {
        totalReports: totalReports?.count || 0,
        participants: participants?.count || 0,
        pendingOrders: pendingOrders?.count || 0,
        byCategory: byCategory.results,
        period,
      },
    });
  } catch (err) {
    console.error('GET /api/ops/summary error:', err);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

export { ops };
