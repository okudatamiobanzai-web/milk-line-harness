-- 画像アップロードテーブル
CREATE TABLE IF NOT EXISTS uploaded_images (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'image/jpeg',
  data TEXT NOT NULL,           -- base64エンコード済み画像データ
  size_bytes INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
