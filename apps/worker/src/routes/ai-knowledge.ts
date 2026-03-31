import { Hono } from 'hono';
import type { Env } from '../index.js';

const aiKnowledge = new Hono<Env>();

// GET /api/ai-knowledge — 一覧取得
aiKnowledge.get('/api/ai-knowledge', async (c) => {
  try {
    const items = await c.env.DB
      .prepare(`SELECT * FROM ai_knowledge ORDER BY created_at DESC`)
      .all();
    return c.json({ success: true, data: items.results });
  } catch (err) {
    console.error('GET /api/ai-knowledge error:', err);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// POST /api/ai-knowledge — 新規作成
aiKnowledge.post('/api/ai-knowledge', async (c) => {
  try {
    const body = await c.req.json<{
      category?: string;
      questionPattern: string;
      wrongAnswer?: string;
      correctAnswer: string;
    }>();

    if (!body.questionPattern || !body.correctAnswer) {
      return c.json({ success: false, error: '質問パターンと正しい回答は必須です' }, 400);
    }

    const id = crypto.randomUUID().replace(/-/g, '');
    const category = body.category || 'correction';

    await c.env.DB
      .prepare(`INSERT INTO ai_knowledge (id, category, question_pattern, wrong_answer, correct_answer) VALUES (?, ?, ?, ?, ?)`)
      .bind(id, category, body.questionPattern, body.wrongAnswer || null, body.correctAnswer)
      .run();

    const item = await c.env.DB
      .prepare(`SELECT * FROM ai_knowledge WHERE id = ?`)
      .bind(id)
      .first();

    return c.json({ success: true, data: item }, 201);
  } catch (err) {
    console.error('POST /api/ai-knowledge error:', err);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// PUT /api/ai-knowledge/:id — 更新
aiKnowledge.put('/api/ai-knowledge/:id', async (c) => {
  try {
    const { id } = c.req.param();
    const body = await c.req.json<{
      category?: string;
      questionPattern?: string;
      wrongAnswer?: string;
      correctAnswer?: string;
      isActive?: boolean;
    }>();

    const existing = await c.env.DB
      .prepare(`SELECT id FROM ai_knowledge WHERE id = ?`)
      .bind(id)
      .first();

    if (!existing) {
      return c.json({ success: false, error: 'Not found' }, 404);
    }

    const updates: string[] = [];
    const bindings: unknown[] = [];

    if (body.category !== undefined) { updates.push('category = ?'); bindings.push(body.category); }
    if (body.questionPattern !== undefined) { updates.push('question_pattern = ?'); bindings.push(body.questionPattern); }
    if (body.wrongAnswer !== undefined) { updates.push('wrong_answer = ?'); bindings.push(body.wrongAnswer || null); }
    if (body.correctAnswer !== undefined) { updates.push('correct_answer = ?'); bindings.push(body.correctAnswer); }
    if (body.isActive !== undefined) { updates.push('is_active = ?'); bindings.push(body.isActive ? 1 : 0); }

    if (updates.length === 0) {
      return c.json({ success: false, error: '更新内容がありません' }, 400);
    }

    updates.push("updated_at = datetime('now')");
    bindings.push(id);

    await c.env.DB
      .prepare(`UPDATE ai_knowledge SET ${updates.join(', ')} WHERE id = ?`)
      .bind(...bindings)
      .run();

    const item = await c.env.DB
      .prepare(`SELECT * FROM ai_knowledge WHERE id = ?`)
      .bind(id)
      .first();

    return c.json({ success: true, data: item });
  } catch (err) {
    console.error('PUT /api/ai-knowledge/:id error:', err);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

// DELETE /api/ai-knowledge/:id — 削除
aiKnowledge.delete('/api/ai-knowledge/:id', async (c) => {
  try {
    const { id } = c.req.param();
    const result = await c.env.DB
      .prepare(`DELETE FROM ai_knowledge WHERE id = ?`)
      .bind(id)
      .run();

    if (!result.meta.changes) {
      return c.json({ success: false, error: 'Not found' }, 404);
    }

    return c.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/ai-knowledge/:id error:', err);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
});

export { aiKnowledge };
