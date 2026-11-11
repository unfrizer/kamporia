ALTER TABLE news ADD COLUMN archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0,1));
--> statement-breakpoint
ALTER TABLE news ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE news ADD COLUMN updated_by TEXT REFERENCES users(id);
--> statement-breakpoint
ALTER TABLE resources ADD COLUMN archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0,1));
--> statement-breakpoint
ALTER TABLE resources ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE resources ADD COLUMN updated_by TEXT REFERENCES users(id);
--> statement-breakpoint
ALTER TABLE club_posts ADD COLUMN archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0,1));
--> statement-breakpoint
ALTER TABLE club_posts ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE club_posts ADD COLUMN updated_by TEXT REFERENCES users(id);
--> statement-breakpoint
CREATE INDEX news_archive_idx ON news(archived,author_id,created_at);
--> statement-breakpoint
CREATE INDEX resources_archive_idx ON resources(archived,author_id,subject);
--> statement-breakpoint
CREATE INDEX club_posts_archive_idx ON club_posts(archived,club_id,created_at);
