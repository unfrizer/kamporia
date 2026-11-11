CREATE TABLE homework (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES groups(id),
  subject TEXT NOT NULL,
  lesson_date TEXT NOT NULL,
  due_date TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  author_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX homework_group_date_idx ON homework(group_id,lesson_date,subject);
--> statement-breakpoint
CREATE INDEX homework_author_idx ON homework(author_id);
