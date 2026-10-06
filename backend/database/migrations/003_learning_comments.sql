BEGIN;
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
COMMIT;
