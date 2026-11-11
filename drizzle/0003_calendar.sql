CREATE TABLE schedule_exceptions (
  id TEXT PRIMARY KEY,
  lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  original_date TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('change','cancel')),
  target_date TEXT NOT NULL,
  group_id TEXT NOT NULL REFERENCES groups(id),
  subject TEXT NOT NULL,
  type TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  room TEXT NOT NULL,
  teacher_id TEXT REFERENCES users(id),
  teacher_name TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  author_id TEXT NOT NULL REFERENCES users(id),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (lesson_id,original_date)
);
--> statement-breakpoint
CREATE INDEX schedule_exceptions_original_idx ON schedule_exceptions(active,original_date);
--> statement-breakpoint
CREATE INDEX schedule_exceptions_target_idx ON schedule_exceptions(active,target_date);
--> statement-breakpoint
CREATE INDEX schedule_exceptions_group_idx ON schedule_exceptions(group_id,updated_at);
