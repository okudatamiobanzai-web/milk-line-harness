-- milk ops: task reports + order tracking
-- Task reports are also logged in messages_log (postback content),
-- but this table provides clean structured data for dashboard queries.

CREATE TABLE IF NOT EXISTS ops_reports (
  id         TEXT PRIMARY KEY,
  friend_id  TEXT REFERENCES friends(id) ON DELETE SET NULL,
  category   TEXT NOT NULL,
  sub_items  TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours'))
);

CREATE INDEX IF NOT EXISTS idx_ops_reports_friend ON ops_reports (friend_id);
CREATE INDEX IF NOT EXISTS idx_ops_reports_created ON ops_reports (created_at);
CREATE INDEX IF NOT EXISTS idx_ops_reports_category ON ops_reports (category);

-- Order tracking — created from LINE postback flow, not forms
CREATE TABLE IF NOT EXISTS ops_orders (
  id              TEXT PRIMARY KEY,
  friend_id       TEXT REFERENCES friends(id) ON DELETE SET NULL,
  item_name       TEXT NOT NULL,
  urgency         TEXT DEFAULT 'low',
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','ordered','delivered')),
  approved_by     TEXT,
  comment         TEXT,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours'))
);

CREATE INDEX IF NOT EXISTS idx_ops_orders_status ON ops_orders (status);
CREATE INDEX IF NOT EXISTS idx_ops_orders_friend ON ops_orders (friend_id);
