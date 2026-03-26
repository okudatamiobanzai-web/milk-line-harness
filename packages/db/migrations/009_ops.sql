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

-- Order status tracking (extends form_submissions)
-- Instead of adding columns to form_submissions, we use a separate table
-- that references submission IDs for the approval workflow.
CREATE TABLE IF NOT EXISTS ops_orders (
  id              TEXT PRIMARY KEY,
  submission_id   TEXT NOT NULL,
  friend_id       TEXT REFERENCES friends(id) ON DELETE SET NULL,
  item_name       TEXT NOT NULL,
  reason          TEXT,
  urgency         TEXT DEFAULT 'normal',
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','ordered','delivered')),
  approved_by     TEXT,
  comment         TEXT,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now', '+9 hours'))
);

CREATE INDEX IF NOT EXISTS idx_ops_orders_status ON ops_orders (status);
CREATE INDEX IF NOT EXISTS idx_ops_orders_friend ON ops_orders (friend_id);
