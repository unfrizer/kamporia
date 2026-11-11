ALTER TABLE users ADD COLUMN bio TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE users ADD COLUMN contact_email TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE users ADD COLUMN phone TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE resources ADD COLUMN kind TEXT NOT NULL DEFAULT 'general' CHECK (kind IN ('general','teacher'));
--> statement-breakpoint
ALTER TABLE resources ADD COLUMN created_at TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE clubs ADD COLUMN about TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE clubs ADD COLUMN meeting_place TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE clubs ADD COLUMN schedule TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
CREATE TABLE club_posts (
  id TEXT PRIMARY KEY,
  club_id TEXT NOT NULL REFERENCES clubs(id),
  author_id TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX club_posts_club_idx ON club_posts(club_id,created_at);
--> statement-breakpoint
CREATE TABLE uploads (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id),
  storage_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL CHECK (size > 0 AND size <= 5242880),
  kind TEXT NOT NULL CHECK (kind IN ('image','file')),
  created_at TEXT NOT NULL,
  news_id TEXT REFERENCES news(id),
  club_post_id TEXT REFERENCES club_posts(id),
  CHECK (news_id IS NULL OR club_post_id IS NULL)
);
--> statement-breakpoint
CREATE INDEX uploads_owner_idx ON uploads(owner_id,created_at);
--> statement-breakpoint
CREATE INDEX uploads_news_idx ON uploads(news_id);
--> statement-breakpoint
CREATE INDEX uploads_club_post_idx ON uploads(club_post_id);
