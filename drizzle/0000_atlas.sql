PRAGMA foreign_keys = ON;
--> statement-breakpoint
CREATE TABLE groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  faculty TEXT NOT NULL,
  direction TEXT NOT NULL,
  course INTEGER NOT NULL,
  description TEXT NOT NULL DEFAULT ''
);
--> statement-breakpoint
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  login TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_iterations INTEGER NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student','teacher','admin')),
  name TEXT NOT NULL,
  initials TEXT NOT NULL,
  faculty TEXT NOT NULL DEFAULT '',
  direction TEXT NOT NULL DEFAULT '',
  course INTEGER,
  group_id TEXT REFERENCES groups(id),
  tag TEXT NOT NULL DEFAULT '',
  accent TEXT NOT NULL DEFAULT 'violet'
);
--> statement-breakpoint
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX sessions_user_idx ON sessions(user_id);
--> statement-breakpoint
CREATE INDEX sessions_expiry_idx ON sessions(expires_at);
--> statement-breakpoint
CREATE TABLE lessons (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES groups(id),
  weekday INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  subject TEXT NOT NULL,
  type TEXT NOT NULL,
  room TEXT NOT NULL,
  teacher_id TEXT REFERENCES users(id),
  teacher_name TEXT NOT NULL,
  changed INTEGER NOT NULL DEFAULT 0,
  change_note TEXT NOT NULL DEFAULT ''
);
--> statement-breakpoint
CREATE INDEX lessons_group_day_idx ON lessons(group_id,weekday,start_time);
--> statement-breakpoint
CREATE INDEX lessons_teacher_idx ON lessons(teacher_id,weekday,start_time);
--> statement-breakpoint
CREATE TABLE grades (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES users(id),
  subject TEXT NOT NULL,
  teacher_id TEXT REFERENCES users(id),
  value INTEGER NOT NULL CHECK (value BETWEEN 2 AND 5),
  kind TEXT NOT NULL CHECK (kind IN ('grade','credit','exam')),
  note TEXT NOT NULL DEFAULT '',
  recorded_at TEXT NOT NULL,
  attended INTEGER NOT NULL DEFAULT 0,
  total_classes INTEGER NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE INDEX grades_student_idx ON grades(student_id,subject);
--> statement-breakpoint
CREATE TABLE exams (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES users(id),
  subject TEXT NOT NULL,
  kind TEXT NOT NULL,
  exam_date TEXT NOT NULL,
  room TEXT NOT NULL,
  status TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX exams_student_idx ON exams(student_id,exam_date);
--> statement-breakpoint
CREATE TABLE requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,
  comment TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('submitted','in_review','ready','rejected')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  staff_reply TEXT NOT NULL DEFAULT ''
);
--> statement-breakpoint
CREATE INDEX requests_user_idx ON requests(user_id,created_at);
--> statement-breakpoint
CREATE TABLE news (
  id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL REFERENCES users(id),
  scope TEXT NOT NULL CHECK (scope IN ('all','group')),
  group_id TEXT REFERENCES groups(id),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  pinned INTEGER NOT NULL DEFAULT 0,
  deadline TEXT
);
--> statement-breakpoint
CREATE INDEX news_scope_idx ON news(scope,group_id,created_at);
--> statement-breakpoint
CREATE TABLE clubs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  color TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT ''
);
--> statement-breakpoint
CREATE TABLE club_members (
  club_id TEXT NOT NULL REFERENCES clubs(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  role TEXT NOT NULL DEFAULT 'Участник',
  PRIMARY KEY (club_id,user_id)
);
--> statement-breakpoint
CREATE TABLE chats (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('group','club','direct')),
  group_id TEXT REFERENCES groups(id),
  club_id TEXT REFERENCES clubs(id),
  folder TEXT NOT NULL DEFAULT 'Общее',
  description TEXT NOT NULL DEFAULT ''
);
--> statement-breakpoint
CREATE TABLE chat_members (
  chat_id TEXT NOT NULL REFERENCES chats(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  role TEXT NOT NULL DEFAULT 'member',
  PRIMARY KEY (chat_id,user_id)
);
--> statement-breakpoint
CREATE TABLE chat_folders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL COLLATE NOCASE,
  created_at TEXT NOT NULL,
  UNIQUE (user_id,name)
);
--> statement-breakpoint
CREATE TABLE chat_folder_assignments (
  chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  folder_id TEXT NOT NULL REFERENCES chat_folders(id) ON DELETE CASCADE,
  PRIMARY KEY (chat_id,user_id)
);
--> statement-breakpoint
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL REFERENCES chats(id),
  author_id TEXT NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX messages_chat_idx ON messages(chat_id,created_at);
--> statement-breakpoint
CREATE TABLE resources (
  id TEXT PRIMARY KEY,
  subject TEXT NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL,
  description TEXT NOT NULL,
  body TEXT NOT NULL,
  group_id TEXT REFERENCES groups(id),
  author_id TEXT REFERENCES users(id)
);
--> statement-breakpoint
CREATE INDEX resources_group_idx ON resources(group_id,subject);
--> statement-breakpoint
CREATE TABLE app_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

