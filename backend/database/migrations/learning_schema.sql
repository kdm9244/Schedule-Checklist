-- Fresh learning schema; requires existing users/events.
BEGIN;
-- PostgreSQL. Apply explicitly; the application never runs this migration on startup.


CREATE TABLE learning_roadmaps (
  roadmap_id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL CHECK (length(trim(title)) > 0),
  description TEXT NOT NULL DEFAULT '',
  target_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, roadmap_id)
);
CREATE TABLE learning_milestones (
  milestone_id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  roadmap_id BIGINT NOT NULL,
  title VARCHAR(200) NOT NULL CHECK (length(trim(title)) > 0),
  description TEXT NOT NULL DEFAULT '',
  due_date DATE,
  sort_order INTEGER NOT NULL CHECK (sort_order >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, milestone_id),
  FOREIGN KEY (user_id, roadmap_id) REFERENCES learning_roadmaps(user_id, roadmap_id) ON DELETE CASCADE
);
CREATE INDEX idx_learning_milestone_order ON learning_milestones(user_id, roadmap_id, sort_order, milestone_id);
CREATE INDEX idx_learning_milestone_due ON learning_milestones(user_id, due_date);

CREATE TABLE learning_tasks (
  task_id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  milestone_id BIGINT NOT NULL,
  title VARCHAR(200) NOT NULL CHECK (length(trim(title)) > 0),
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, task_id),
  UNIQUE (user_id, milestone_id, task_id),
  FOREIGN KEY (user_id, milestone_id) REFERENCES learning_milestones(user_id, milestone_id) ON DELETE CASCADE
);
CREATE INDEX idx_learning_task_order ON learning_tasks(user_id, milestone_id, sort_order, task_id);

CREATE TABLE learning_records (
  record_id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  milestone_id BIGINT,
  task_id BIGINT,
  study_date DATE NOT NULL,
  title VARCHAR(200) NOT NULL CHECK (length(trim(title)) > 0),
  body_markdown TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (task_id IS NULL OR milestone_id IS NOT NULL),
  FOREIGN KEY (user_id, milestone_id) REFERENCES learning_milestones(user_id, milestone_id),
  FOREIGN KEY (user_id, milestone_id, task_id) REFERENCES learning_tasks(user_id, milestone_id, task_id)
);
CREATE INDEX idx_learning_record_date ON learning_records(user_id, study_date DESC, record_id DESC);
CREATE INDEX idx_learning_record_milestone ON learning_records(user_id, milestone_id, study_date DESC);
CREATE INDEX idx_learning_record_task ON learning_records(user_id, task_id) WHERE task_id IS NOT NULL;

-- App-local study sessions share one data source between roadmap and calendar.
-- An optional mirror event ID supports association with an existing calendar event.
CREATE TABLE learning_schedules (
  schedule_id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  task_id BIGINT NOT NULL,
  event_id BIGINT REFERENCES events(event_id) ON DELETE SET NULL,
  scheduled_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id, task_id) REFERENCES learning_tasks(user_id, task_id) ON DELETE CASCADE
);
CREATE INDEX idx_learning_schedule_date ON learning_schedules(user_id, scheduled_date, schedule_id);
CREATE INDEX idx_learning_schedule_task ON learning_schedules(user_id, task_id);
CREATE INDEX idx_learning_schedule_event ON learning_schedules(event_id) WHERE event_id IS NOT NULL;

-- Preserve journals even for deletes issued outside the API, including parent cascades.
CREATE FUNCTION learning_preserve_records() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'learning_milestones' THEN
    UPDATE learning_records SET milestone_id=NULL, task_id=NULL, updated_at=CURRENT_TIMESTAMP
    WHERE user_id=OLD.user_id AND milestone_id=OLD.milestone_id;
  ELSE
    UPDATE learning_records SET task_id=NULL, updated_at=CURRENT_TIMESTAMP
    WHERE user_id=OLD.user_id AND task_id=OLD.task_id;
  END IF;
  RETURN OLD;
END;
$$;
CREATE TRIGGER learning_milestone_preserve BEFORE DELETE ON learning_milestones
  FOR EACH ROW EXECUTE FUNCTION learning_preserve_records();
CREATE TRIGGER learning_task_preserve BEFORE DELETE ON learning_tasks
  FOR EACH ROW EXECUTE FUNCTION learning_preserve_records();

CREATE FUNCTION learning_check_event_owner() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.event_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM events WHERE event_id=NEW.event_id AND user_id=NEW.user_id AND NOT is_deleted
  ) THEN RAISE EXCEPTION 'Invalid calendar event owner' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER learning_schedule_event_owner BEFORE INSERT OR UPDATE ON learning_schedules
  FOR EACH ROW EXECUTE FUNCTION learning_check_event_owner();
ALTER TABLE learning_roadmaps ADD COLUMN start_date DATE;
ALTER TABLE learning_milestones ADD COLUMN start_date DATE;
ALTER TABLE learning_records ADD COLUMN input_mode TEXT NOT NULL DEFAULT 'markdown' CHECK (input_mode IN ('plain','markdown'));
-- Existing undated rows remain intact; new API writes require complete periods.
ALTER TABLE learning_roadmaps ADD CONSTRAINT learning_roadmap_period CHECK (start_date IS NULL OR target_date IS NULL OR start_date <= target_date);
ALTER TABLE learning_milestones ADD CONSTRAINT learning_milestone_period CHECK (start_date IS NULL OR due_date IS NULL OR start_date <= due_date);
CREATE FUNCTION learning_check_period() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent_start DATE; parent_end DATE;
BEGIN
  IF TG_TABLE_NAME = 'learning_milestones' THEN
    SELECT start_date,target_date INTO parent_start,parent_end FROM learning_roadmaps WHERE roadmap_id=NEW.roadmap_id AND user_id=NEW.user_id FOR UPDATE;
    IF NEW.start_date IS NULL OR NEW.due_date IS NULL OR parent_start IS NULL OR parent_end IS NULL OR NEW.start_date < parent_start OR NEW.due_date > parent_end THEN
      RAISE EXCEPTION 'Milestone outside roadmap period' USING ERRCODE='23514';
    END IF;
  ELSE
    IF EXISTS (SELECT 1 FROM learning_milestones WHERE roadmap_id=NEW.roadmap_id AND (start_date IS NULL OR due_date IS NULL OR NEW.start_date IS NULL OR NEW.target_date IS NULL OR start_date<NEW.start_date OR due_date>NEW.target_date)) THEN
      RAISE EXCEPTION 'Roadmap period excludes milestones' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER learning_milestone_period_guard BEFORE INSERT OR UPDATE OF start_date,due_date,roadmap_id ON learning_milestones FOR EACH ROW EXECUTE FUNCTION learning_check_period();
CREATE TRIGGER learning_roadmap_period_guard BEFORE UPDATE OF start_date,target_date ON learning_roadmaps FOR EACH ROW EXECUTE FUNCTION learning_check_period();
ALTER TABLE learning_records ADD CONSTRAINT learning_record_owner_unique UNIQUE(user_id,record_id);
CREATE TABLE learning_comments (
  comment_id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  record_id BIGINT NOT NULL,
  block_start INTEGER NOT NULL CHECK(block_start>=0),
  block_source TEXT NOT NULL CHECK(length(block_source)<=200000),
  line_number INTEGER NOT NULL CHECK(line_number>=1 AND line_number<=200000),
  line_text TEXT NOT NULL CHECK(length(line_text)<=200000),
  body TEXT NOT NULL CHECK(length(trim(body))>0 AND length(body)<=10000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id,record_id) REFERENCES learning_records(user_id,record_id) ON DELETE CASCADE
);
CREATE INDEX idx_learning_comment_record ON learning_comments(user_id,record_id,comment_id);
ALTER TABLE learning_comments ADD COLUMN end_line INTEGER;
UPDATE learning_comments SET end_line=line_number;
ALTER TABLE learning_comments ALTER COLUMN end_line SET NOT NULL;
ALTER TABLE learning_comments ADD CONSTRAINT learning_comment_range CHECK(end_line>=line_number AND end_line<=200000);
COMMIT;
