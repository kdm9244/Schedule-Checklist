BEGIN;
CREATE TABLE IF NOT EXISTS pdf_note_words (
 word_id BIGSERIAL PRIMARY KEY,
 note_id BIGINT NOT NULL REFERENCES pdf_notes(note_id) ON DELETE CASCADE,
 word VARCHAR(200) NOT NULL CHECK(length(trim(word)) > 0),
 reading VARCHAR(200) NOT NULL DEFAULT '',
 meaning VARCHAR(1000) NOT NULL CHECK(length(trim(meaning)) > 0),
 page INTEGER NOT NULL CHECK(page BETWEEN 1 AND 100000),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pdf_words_note ON pdf_note_words(note_id,word_id);
COMMIT;
