-- Staff are not members of student study groups. Existing messages are preserved.
UPDATE users SET group_id=NULL,course=NULL WHERE role IN ('teacher','admin');
--> statement-breakpoint
DELETE FROM chat_folder_assignments WHERE user_id IN (SELECT id FROM users WHERE role IN ('teacher','admin')) AND chat_id IN (SELECT id FROM chats WHERE kind='group');
--> statement-breakpoint
DELETE FROM chat_members WHERE user_id IN (SELECT id FROM users WHERE role IN ('teacher','admin')) AND chat_id IN (SELECT id FROM chats WHERE kind='group');
--> statement-breakpoint
UPDATE users SET tag=CASE tag WHEN 'student' THEN 'Студент' WHEN 'teacher' THEN 'Преподаватель' WHEN 'admin' THEN 'Администратор' WHEN 'starosta' THEN 'Староста' ELSE tag END WHERE tag IN ('student','teacher','admin','starosta');
