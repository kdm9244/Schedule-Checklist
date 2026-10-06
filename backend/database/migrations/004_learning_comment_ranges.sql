BEGIN;
ALTER TABLE learning_comments ADD COLUMN end_line INTEGER;
UPDATE learning_comments SET end_line=line_number;
ALTER TABLE learning_comments ALTER COLUMN end_line SET NOT NULL;
ALTER TABLE learning_comments ADD CONSTRAINT learning_comment_range CHECK(end_line>=line_number AND end_line<=200000);
COMMIT;
