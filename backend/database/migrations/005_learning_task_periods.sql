BEGIN;
ALTER TABLE learning_tasks ADD COLUMN start_date DATE;
ALTER TABLE learning_tasks ADD COLUMN target_date DATE;
ALTER TABLE learning_tasks ADD CONSTRAINT learning_task_period CHECK(start_date IS NULL OR target_date IS NULL OR start_date<=target_date);
-- Defer the journal's composite task FK while task and journal parents move together.
DO $$ DECLARE fk RECORD; BEGIN
 FOR fk IN SELECT conname FROM pg_constraint WHERE conrelid='learning_records'::regclass AND confrelid='learning_tasks'::regclass AND contype='f' LOOP
  EXECUTE format('ALTER TABLE learning_records ALTER CONSTRAINT %I DEFERRABLE INITIALLY IMMEDIATE',fk.conname);
 END LOOP;
END $$;
COMMIT;
