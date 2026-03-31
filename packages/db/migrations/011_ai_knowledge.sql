-- AI修正ナレッジテーブル
-- AIが間違った回答をした場合の修正例を蓄積する
CREATE TABLE IF NOT EXISTS ai_knowledge (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  category TEXT NOT NULL DEFAULT 'correction',  -- 'correction' | 'fact' | 'rule'
  question_pattern TEXT NOT NULL,                -- 質問パターン（例: 空き状況, 予約）
  wrong_answer TEXT,                             -- AIがしがちな間違い回答
  correct_answer TEXT NOT NULL,                  -- 正しい回答内容
  is_active INTEGER NOT NULL DEFAULT 1,          -- 有効/無効
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
