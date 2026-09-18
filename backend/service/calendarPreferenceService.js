const db = require('../database/DAO')

let schemaPromise
function ensureSchema() {
  if (!schemaPromise) schemaPromise = db.query(`CREATE TABLE IF NOT EXISTS user_calendar_preferences (
    user_id BIGINT NOT NULL,
    calendar_id TEXT NOT NULL,
    is_visible BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(user_id,calendar_id)
  )`).catch(error => { schemaPromise = null; throw error })
  return schemaPromise
}

function normalizeVisibility(data) {
  if (!data || typeof data.calendarId !== 'string' || !data.calendarId.trim() || data.calendarId.length > 1024 || typeof data.visible !== 'boolean') {
    throw new Error('INVALID_CALENDAR_PREFERENCE')
  }
  return { calendarId:data.calendarId.trim(), visible:data.visible }
}

async function visibilityMap(userId) {
  await ensureSchema()
  const rows = (await db.query('SELECT calendar_id,is_visible FROM user_calendar_preferences WHERE user_id=$1', [userId])).rows
  return new Map(rows.map(row => [row.calendar_id,row.is_visible]))
}

async function setVisibility(userId, data) {
  const value = normalizeVisibility(data)
  await ensureSchema()
  return (await db.query(`INSERT INTO user_calendar_preferences(user_id,calendar_id,is_visible)
    VALUES($1,$2,$3)
    ON CONFLICT(user_id,calendar_id) DO UPDATE SET is_visible=EXCLUDED.is_visible,updated_at=CURRENT_TIMESTAMP
    RETURNING calendar_id,is_visible`, [userId,value.calendarId,value.visible])).rows[0]
}

module.exports = { ensureSchema, normalizeVisibility, visibilityMap, setVisibility }
