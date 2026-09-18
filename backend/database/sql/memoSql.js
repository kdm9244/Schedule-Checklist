const FIND_BY_DATE = `
  SELECT memo_id, memo_date, content, created_at, updated_at
  FROM daily_memos
  WHERE user_id = $1 AND memo_date = $2
`

const UPSERT_MEMO = `
  INSERT INTO daily_memos (user_id, memo_date, content)
  VALUES ($1, $2, $3)
  ON CONFLICT (user_id, memo_date)
  DO UPDATE SET
    content = EXCLUDED.content,
    updated_at = CURRENT_TIMESTAMP
  RETURNING memo_id, memo_date, content, created_at, updated_at
`

module.exports = { FIND_BY_DATE, UPSERT_MEMO }
