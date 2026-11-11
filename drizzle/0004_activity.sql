CREATE TABLE activity_notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_key TEXT NOT NULL,
  entity_key TEXT NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  visible_until TEXT,
  link_json TEXT NOT NULL,
  read_at TEXT,
  UNIQUE(user_id,source_key)
);
--> statement-breakpoint
CREATE INDEX activity_notifications_user_idx ON activity_notifications(user_id,created_at DESC);
--> statement-breakpoint
CREATE INDEX activity_notifications_unread_idx ON activity_notifications(user_id,read_at);
--> statement-breakpoint
CREATE TABLE chat_read_cursors (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  last_message_rowid INTEGER NOT NULL DEFAULT 0,
  last_message_id TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(user_id,chat_id)
);
