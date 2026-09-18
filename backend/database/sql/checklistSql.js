const FIND_BY_DATE = `
  SELECT
    c.checklist_id,
    c.user_id,
    c.event_id,
    c.template_id,
    c.title,
    c.target_date,
    c.is_completed,
    c.sort_order,
    c.created_at,
    c.updated_at
  FROM checklists c
  LEFT JOIN checklist_templates t
    ON t.user_id = c.user_id AND t.template_id = c.template_id
  WHERE c.user_id = $1
    AND c.target_date = $2
    AND c.event_id IS NULL
    AND (c.template_id IS NULL OR c.target_date < CURRENT_DATE OR t.is_active = TRUE)
  ORDER BY c.sort_order ASC, c.checklist_id ASC
`

const FIND_BY_EVENT_ID = `
  SELECT
    checklist_id,
    user_id,
    event_id,
    title,
    target_date,
    is_completed,
    sort_order,
    created_at,
    updated_at
  FROM checklists
  WHERE user_id = $1
    AND event_id = $2
  ORDER BY sort_order ASC, checklist_id ASC
`

const INSERT_CHECKLIST = `
  INSERT INTO checklists (
    user_id,
    event_id,
    title,
    target_date,
    is_completed,
    sort_order
  )
  VALUES (
    $1,
    $2,
    $3,
    $4,
    false,
    $5
  )
  RETURNING *
`

const UPDATE_CHECKLIST = `
  UPDATE checklists
  SET
    title = $1,
    target_date = $2,
    sort_order = $3,
    updated_at = CURRENT_TIMESTAMP
  WHERE checklist_id = $4
    AND user_id = $5
  RETURNING *
`

const UPDATE_STATUS = `
  UPDATE checklists
  SET
    is_completed = $1,
    updated_at = CURRENT_TIMESTAMP
  WHERE checklist_id = $2
    AND user_id = $3
  RETURNING *
`

const DELETE_CHECKLIST = `
  DELETE FROM checklists
  WHERE checklist_id = $1
    AND user_id = $2
  RETURNING checklist_id
`

const GET_NEXT_SORT_ORDER = `
  SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_sort_order
  FROM checklists
  WHERE user_id = $1
    AND target_date = $2
`

module.exports = {
  FIND_BY_DATE,
  FIND_BY_EVENT_ID,
  INSERT_CHECKLIST,
  UPDATE_CHECKLIST,
  UPDATE_STATUS,
  DELETE_CHECKLIST,
  GET_NEXT_SORT_ORDER
}
