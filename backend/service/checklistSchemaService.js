const db = require('../database/DAO')

let schemaPromise

function ensureSchema() {
  if (!schemaPromise) schemaPromise = migrate().catch(error => {
    schemaPromise = null
    throw error
  })
  return schemaPromise
}

async function migrate() {
  const client = await db.pool.connect()
  try {
    await client.query('BEGIN')
    await client.query('LOCK TABLE checklists IN ACCESS EXCLUSIVE MODE')
    const column = (await client.query(`SELECT data_type
      FROM information_schema.columns
      WHERE table_schema=current_schema() AND table_name='checklists' AND column_name='event_id'`)).rows[0]

    if (column && column.data_type !== 'character varying' && column.data_type !== 'text') {
      await client.query('ALTER TABLE checklists ADD COLUMN IF NOT EXISTS event_key VARCHAR(1000)')
      await client.query(`UPDATE checklists c
        SET event_key=COALESCE(e.google_event_id,c.event_id::text)
        FROM events e
        WHERE c.event_id IS NOT NULL AND e.user_id=c.user_id AND e.event_id=c.event_id`)
      await client.query(`UPDATE checklists SET event_key=event_id::text
        WHERE event_id IS NOT NULL AND event_key IS NULL`)
      await client.query('ALTER TABLE checklists DROP CONSTRAINT IF EXISTS fk_checklists_event')
      await client.query('ALTER TABLE checklists DROP COLUMN event_id')
      await client.query('ALTER TABLE checklists RENAME COLUMN event_key TO event_id')
    }

    await client.query(`CREATE INDEX IF NOT EXISTS idx_checklists_user_event
      ON checklists(user_id,event_id) WHERE event_id IS NOT NULL`)
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

module.exports = { ensureSchema }
