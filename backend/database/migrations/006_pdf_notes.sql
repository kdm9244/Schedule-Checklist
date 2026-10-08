BEGIN;
CREATE TABLE IF NOT EXISTS pdf_notes (
 note_id BIGSERIAL PRIMARY KEY,
 user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
 title VARCHAR(200) NOT NULL,
 file_key UUID NOT NULL UNIQUE,
 file_size INTEGER NOT NULL CHECK(file_size > 0),
 roadmap_id BIGINT REFERENCES learning_roadmaps(roadmap_id) ON DELETE SET NULL,
 milestone_id BIGINT REFERENCES learning_milestones(milestone_id) ON DELETE SET NULL,
 task_id BIGINT REFERENCES learning_tasks(task_id) ON DELETE SET NULL,
 last_page INTEGER NOT NULL DEFAULT 1 CHECK(last_page > 0),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pdf_notes_owner ON pdf_notes(user_id);
CREATE TABLE IF NOT EXISTS pdf_note_entries (
 entry_id BIGSERIAL PRIMARY KEY,
 note_id BIGINT NOT NULL REFERENCES pdf_notes(note_id) ON DELETE CASCADE,
 question VARCHAR(200) NOT NULL DEFAULT '',
 page INTEGER NOT NULL CHECK(page > 0),
 interpretation TEXT NOT NULL DEFAULT '',
 solution TEXT NOT NULL DEFAULT '',
 review TEXT NOT NULL DEFAULT '',
 status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','done','review')),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pdf_entries_note ON pdf_note_entries(note_id,page,entry_id);
CREATE OR REPLACE FUNCTION sync_pdf_task_parent() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 UPDATE pdf_notes SET milestone_id=NEW.milestone_id,
 roadmap_id=(SELECT roadmap_id FROM learning_milestones WHERE milestone_id=NEW.milestone_id)
 WHERE task_id=NEW.task_id AND user_id=NEW.user_id;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS pdf_task_parent ON learning_tasks;
CREATE TRIGGER pdf_task_parent AFTER UPDATE OF milestone_id ON learning_tasks
FOR EACH ROW WHEN (OLD.milestone_id IS DISTINCT FROM NEW.milestone_id) EXECUTE FUNCTION sync_pdf_task_parent();
COMMIT;
