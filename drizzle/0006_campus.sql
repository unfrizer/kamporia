CREATE TABLE campus_tasks (
 id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 title TEXT NOT NULL,subject TEXT NOT NULL DEFAULT '',due_date TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'todo' CHECK(status IN ('todo','doing','done')),
 created_at TEXT NOT NULL,updated_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX campus_tasks_user_date ON campus_tasks(user_id,due_date);
--> statement-breakpoint
CREATE TABLE campus_progress (
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,source_key TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('todo','doing','done')),updated_at TEXT NOT NULL,
 PRIMARY KEY(user_id,source_key)
);
--> statement-breakpoint
CREATE TABLE campus_preferences (
 user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 widgets_json TEXT NOT NULL,compact INTEGER NOT NULL DEFAULT 0 CHECK(compact IN (0,1)),updated_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE campus_events (
 id TEXT PRIMARY KEY,club_id TEXT NOT NULL REFERENCES clubs(id),author_id TEXT NOT NULL REFERENCES users(id),
 title TEXT NOT NULL,body TEXT NOT NULL,starts_at TEXT NOT NULL,ends_at TEXT NOT NULL,
 place TEXT NOT NULL,capacity INTEGER NOT NULL CHECK(capacity BETWEEN 1 AND 500),
 audience TEXT NOT NULL DEFAULT 'all' CHECK(audience IN ('all','members')),
 cover TEXT NOT NULL DEFAULT 'orbit' CHECK(cover IN ('orbit','studio','nature','sport')),
 status TEXT NOT NULL DEFAULT 'published' CHECK(status IN ('published','cancelled')),
 created_at TEXT NOT NULL,updated_at TEXT NOT NULL,CHECK(ends_at>starts_at)
);
--> statement-breakpoint
CREATE INDEX campus_events_club_date ON campus_events(club_id,starts_at);
--> statement-breakpoint
CREATE TABLE campus_event_members (
 event_id TEXT NOT NULL REFERENCES campus_events(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 status TEXT NOT NULL CHECK(status IN ('going','cancelled')),updated_at TEXT NOT NULL,
 PRIMARY KEY(event_id,user_id)
);
--> statement-breakpoint
CREATE TABLE campus_slots (
 id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES users(id),group_id TEXT REFERENCES groups(id),
 starts_at TEXT NOT NULL,ends_at TEXT NOT NULL,place TEXT NOT NULL,
 format TEXT NOT NULL CHECK(format IN ('offline','online')),
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','cancelled')),
 created_at TEXT NOT NULL,updated_at TEXT NOT NULL,CHECK(ends_at>starts_at)
);
--> statement-breakpoint
CREATE INDEX campus_slots_owner_date ON campus_slots(owner_id,starts_at);
--> statement-breakpoint
CREATE TABLE campus_bookings (
 id TEXT PRIMARY KEY,slot_id TEXT NOT NULL REFERENCES campus_slots(id),
 user_id TEXT NOT NULL REFERENCES users(id),topic TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('confirmed','cancelled')),created_at TEXT NOT NULL,updated_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX campus_bookings_one_slot ON campus_bookings(slot_id) WHERE status='confirmed';
--> statement-breakpoint
CREATE INDEX campus_bookings_user ON campus_bookings(user_id,status);
--> statement-breakpoint
CREATE TABLE campus_grading (
 group_id TEXT NOT NULL REFERENCES groups(id),subject TEXT NOT NULL,
 author_id TEXT NOT NULL REFERENCES users(id),current_weight INTEGER NOT NULL CHECK(current_weight BETWEEN 5 AND 95),
 note TEXT NOT NULL DEFAULT '',updated_at TEXT NOT NULL,PRIMARY KEY(group_id,subject)
);
--> statement-breakpoint
CREATE TABLE campus_places (
 room TEXT PRIMARY KEY,title TEXT NOT NULL,building TEXT NOT NULL CHECK(building IN ('A','B','C')),
 floor INTEGER NOT NULL CHECK(floor BETWEEN 1 AND 6),directions TEXT NOT NULL,updated_at TEXT NOT NULL
);
