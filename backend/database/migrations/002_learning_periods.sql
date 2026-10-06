BEGIN;
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
COMMIT;
