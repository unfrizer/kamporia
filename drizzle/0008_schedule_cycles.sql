ALTER TABLE lessons ADD COLUMN week_pattern TEXT NOT NULL DEFAULT 'all' CHECK(week_pattern IN ('all','first','second'));
--> statement-breakpoint
ALTER TABLE lessons ADD COLUMN single_date TEXT;
--> statement-breakpoint
ALTER TABLE lessons ADD COLUMN single_original_date TEXT;
--> statement-breakpoint
ALTER TABLE lessons ADD COLUMN active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1));
--> statement-breakpoint
ALTER TABLE lessons ADD COLUMN author_id TEXT REFERENCES users(id);
--> statement-breakpoint
ALTER TABLE lessons ADD COLUMN created_at TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE lessons ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
CREATE TABLE lesson_groups(lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,group_id TEXT NOT NULL REFERENCES groups(id),PRIMARY KEY(lesson_id,group_id));
--> statement-breakpoint
INSERT INTO lesson_groups(lesson_id,group_id) SELECT id,group_id FROM lessons;
--> statement-breakpoint
CREATE VIEW teaching_assignments AS SELECT l.id,COALESCE(lg.group_id,l.group_id) AS group_id,l.weekday,l.start_time,l.end_time,l.subject,l.type,l.room,l.teacher_id,l.teacher_name,l.changed,l.change_note,l.week_pattern,l.single_date,l.single_original_date,l.active,l.author_id,l.created_at,l.updated_at FROM lessons l LEFT JOIN lesson_groups lg ON lg.lesson_id=l.id WHERE l.active=1;
--> statement-breakpoint
CREATE TABLE schedule_cycle_config (
 id INTEGER PRIMARY KEY CHECK(id=1), enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
 mode TEXT NOT NULL DEFAULT 'numbered',calculation TEXT NOT NULL DEFAULT 'anchor' CHECK(calculation IN ('anchor','calendar')),first_label TEXT NOT NULL DEFAULT 'Первая',second_label TEXT NOT NULL DEFAULT 'Вторая',
 anchor_date TEXT NOT NULL DEFAULT '1970-01-05',anchor_type INTEGER NOT NULL DEFAULT 1 CHECK(anchor_type IN (1,2)),updated_at TEXT NOT NULL DEFAULT ''
);
--> statement-breakpoint
INSERT INTO schedule_cycle_config(id) VALUES(1);
--> statement-breakpoint
CREATE TABLE schedule_revision (id INTEGER PRIMARY KEY CHECK(id=1),revision INTEGER NOT NULL CONSTRAINT schedule_revision_valid CHECK(revision>=0));
--> statement-breakpoint
INSERT INTO schedule_revision VALUES(1,0);
--> statement-breakpoint
CREATE TABLE schedule_updates (
 id TEXT PRIMARY KEY,entity_kind TEXT NOT NULL,entity_id TEXT NOT NULL,group_id TEXT,previous_group_id TEXT,
 teacher_id TEXT,previous_teacher_id TEXT,actor_id TEXT NOT NULL REFERENCES users(id),
 title TEXT NOT NULL,body TEXT NOT NULL,lesson_date TEXT,created_at TEXT NOT NULL,group_ids_json TEXT NOT NULL DEFAULT '[]'
);
--> statement-breakpoint
CREATE INDEX schedule_updates_time ON schedule_updates(created_at);
--> statement-breakpoint
CREATE INDEX schedule_updates_entity ON schedule_updates(entity_kind,entity_id);
--> statement-breakpoint
CREATE INDEX lessons_single_date ON lessons(single_date);
