BEGIN;
ALTER TABLE pdf_note_entries ADD COLUMN IF NOT EXISTS body_format VARCHAR(10) NOT NULL DEFAULT 'plain' CHECK(body_format IN ('plain','richtext'));
COMMIT;
