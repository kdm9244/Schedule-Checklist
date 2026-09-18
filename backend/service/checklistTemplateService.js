const db = require('../database/DAO')
const { validDate } = require('../utils/validation')

let schemaPromise
function ensureSchema() {
  if (!schemaPromise) schemaPromise = (async () => {
    await db.query(`CREATE TABLE IF NOT EXISTS checklist_templates (
      template_id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL,
      title VARCHAR(200) NOT NULL,
      days_of_week SMALLINT[] NOT NULL,
      start_date DATE NOT NULL DEFAULT CURRENT_DATE,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`)
    await db.query('ALTER TABLE checklist_templates ADD COLUMN IF NOT EXISTS start_date DATE NOT NULL DEFAULT CURRENT_DATE')
    await db.query('ALTER TABLE checklists ADD COLUMN IF NOT EXISTS template_id BIGINT')
    await db.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_checklists_template_day
      ON checklists(user_id,target_date,template_id) WHERE template_id IS NOT NULL`)
    await db.query(`CREATE TABLE IF NOT EXISTS checklist_template_skips (
      user_id BIGINT NOT NULL,
      template_id BIGINT NOT NULL,
      target_date DATE NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(user_id,template_id,target_date)
    )`)
  })().catch(error => { schemaPromise = null; throw error })
  return schemaPromise
}

function normalize(data, partial = false) {
  const result = {}
  if (!partial || data.title !== undefined) {
    if (typeof data.title !== 'string' || !data.title.trim() || data.title.trim().length > 200) throw new Error('INVALID_TEMPLATE')
    result.title = data.title.trim()
  }
  if (!partial || data.daysOfWeek !== undefined) {
    if (!Array.isArray(data.daysOfWeek) || !data.daysOfWeek.length || data.daysOfWeek.some(day => !Number.isInteger(day) || day < 0 || day > 6)) throw new Error('INVALID_TEMPLATE')
    result.daysOfWeek = [...new Set(data.daysOfWeek)].sort((a,b) => a-b)
  }
  if (data.active !== undefined) result.active = data.active === true
  if (data.startDate !== undefined) {
    if (!validDate(data.startDate)) throw new Error('INVALID_TEMPLATE')
    result.startDate = data.startDate
  }
  return result
}

async function list(userId) {
  await ensureSchema()
  return (await db.query(`SELECT template_id,title,days_of_week,start_date,is_active,sort_order
    FROM checklist_templates WHERE user_id=$1 ORDER BY sort_order,template_id`, [userId])).rows
}

async function create(userId, data) {
  await ensureSchema()
  const value = normalize(data)
  return (await db.query(`INSERT INTO checklist_templates(user_id,title,days_of_week,start_date,is_active,sort_order)
    VALUES($1,$2,$3::smallint[],COALESCE($4::date,CURRENT_DATE),TRUE,(SELECT COALESCE(MAX(sort_order),0)+1 FROM checklist_templates WHERE user_id=$1))
    RETURNING template_id,title,days_of_week,start_date,is_active,sort_order`, [userId,value.title,value.daysOfWeek,value.startDate || null])).rows[0]
}

async function update(userId, id, data) {
  await ensureSchema()
  const value = normalize(data, true)
  const ruleChanged = value.title !== undefined || value.daysOfWeek !== undefined || value.startDate !== undefined
  return (await db.query(`WITH updated_template AS (
      UPDATE checklist_templates SET
        title=COALESCE($1,title),days_of_week=COALESCE($2::smallint[],days_of_week),
        is_active=COALESCE($3::boolean,is_active),start_date=COALESCE($4::date,start_date),updated_at=CURRENT_TIMESTAMP
      WHERE user_id=$5 AND template_id=$6
      RETURNING template_id,title,days_of_week,start_date,is_active,sort_order
    ), removed_items AS (
      DELETE FROM checklists c USING updated_template t
      WHERE c.user_id=$5 AND c.template_id=t.template_id AND c.target_date >= CURRENT_DATE
        AND $7::boolean
      RETURNING c.checklist_id
    )
    SELECT t.*,(SELECT COUNT(*)::integer FROM removed_items) AS removed_count
    FROM updated_template t`, [
      value.title ?? null, value.daysOfWeek ?? null, value.active ?? null,
      value.startDate ?? null, userId,id,ruleChanged
    ])).rows[0] || null
}

async function remove(userId, id) {
  await ensureSchema()
  return (await db.query(`WITH deleted_template AS (
      DELETE FROM checklist_templates WHERE user_id=$1 AND template_id=$2 RETURNING template_id
    ), removed_items AS (
      DELETE FROM checklists c USING deleted_template t
      WHERE c.user_id=$1 AND c.template_id=t.template_id AND c.target_date >= CURRENT_DATE
      RETURNING c.checklist_id
    ), removed_skips AS (
      DELETE FROM checklist_template_skips s USING deleted_template t
      WHERE s.user_id=$1 AND s.template_id=t.template_id
      RETURNING s.template_id
    )
    SELECT t.template_id,(SELECT COUNT(*)::integer FROM removed_items) AS removed_count
    FROM deleted_template t`, [userId,id])).rows[0] || null
}

async function materializeForDate(userId, date) {
  if (!validDate(date)) return
  await ensureSchema()
  const day = new Date(date + 'T00:00:00Z').getUTCDay()
  await db.query(`INSERT INTO checklists(user_id,event_id,title,target_date,is_completed,sort_order,template_id)
    SELECT t.user_id,NULL,t.title,$2::date,FALSE,
      COALESCE((SELECT MAX(c.sort_order) FROM checklists c WHERE c.user_id=$1 AND c.target_date=$2 AND c.event_id IS NULL),0)
        + ROW_NUMBER() OVER(ORDER BY t.sort_order,t.template_id),t.template_id
    FROM checklist_templates t
    WHERE t.user_id=$1 AND t.is_active=TRUE AND t.start_date <= $2::date AND $3::smallint=ANY(t.days_of_week)
      AND NOT EXISTS(SELECT 1 FROM checklist_template_skips s
        WHERE s.user_id=t.user_id AND s.template_id=t.template_id AND s.target_date=$2::date)
    ON CONFLICT(user_id,target_date,template_id) WHERE template_id IS NOT NULL DO NOTHING`, [userId,date,day])
}

async function skipInstanceForChecklist(userId, checklistId) {
  await ensureSchema()
  await db.query(`INSERT INTO checklist_template_skips(user_id,template_id,target_date)
    SELECT user_id,template_id,target_date FROM checklists
    WHERE user_id=$1 AND checklist_id=$2 AND template_id IS NOT NULL
    ON CONFLICT DO NOTHING`, [userId,checklistId])
}

module.exports = { ensureSchema, normalize, list, create, update, remove, materializeForDate, skipInstanceForChecklist }
