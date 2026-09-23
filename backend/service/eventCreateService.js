const crypto = require('node:crypto')
const { validDate, badRequest } = require('../utils/validation')
const { createCalendar } = require('./calendarService')
const { pool } = require('../database/DAO')

function validateEvent(data) {
  if (!data || typeof data.title !== 'string' || !data.title.trim() || data.title.length > 100 ||
      !validDate(data.date) || typeof data.allDay !== 'boolean' ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(data.requestId || '')) throw badRequest('予定名と日付を確認してください。')
  const time = /^([01]\d|2[0-3]):[0-5]\d$/
  if (!data.allDay && (!time.test(data.startTime) || !time.test(data.endTime) || data.startTime >= data.endTime)) {
    throw badRequest('終了時間は開始時間より後に設定してください。')
  }
  for (const [key, max] of [['location', 150], ['description', 500]]) {
    if (typeof data[key] !== 'string' || data[key].length > max) throw badRequest('入力内容が長すぎます。')
  }
  if (!Array.isArray(data.checklists) || data.checklists.length > 100 ||
      data.checklists.some(item => !item || typeof item.title !== 'string' || !item.title.trim() || item.title.length > 200)) {
    throw badRequest('チェックリストの内容を確認してください。')
  }
  try { new Intl.DateTimeFormat('ja-JP', { timeZone: data.timeZone }).format() } catch {
    throw badRequest('タイムゾーンを確認してください。')
  }
  if (typeof data.timeZone !== 'string' || !data.timeZone) throw badRequest('タイムゾーンが必要です。')
  return {
    title: data.title.trim(), date: data.date, allDay: data.allDay,
    startTime: data.allDay ? '' : data.startTime, endTime: data.allDay ? '' : data.endTime,
    location: data.location.trim(), description: data.description,
    timeZone: data.timeZone, checklists: data.checklists.map(item => ({ title: item.title.trim() }))
  }
}

function googleBody(data, id, hash) {
  const next = new Date(data.date + 'T00:00:00Z')
  next.setUTCDate(next.getUTCDate() + 1)
  return {
    id, summary: data.title, location: data.location, description: data.description,
    start: data.allDay ? { date: data.date } : { dateTime: data.date + 'T' + data.startTime + ':00', timeZone: data.timeZone },
    end: data.allDay ? { date: next.toISOString().slice(0, 10) } : { dateTime: data.date + 'T' + data.endTime + ':00', timeZone: data.timeZone },
    extendedProperties: { private: { scheduleChecklistHash: hash } }
  }
}

// Dependency injection permits real DB transactions with a fake Google boundary in tests.
async function createEvent(userId, tokens, input, deps = {}) {
  if (!deps.pool) await require('./checklistSchemaService').ensureSchema()
  const data = validateEvent(input)
  const calendar = deps.calendar || createCalendar(tokens)
  const db = deps.pool || pool
  const id = crypto.createHash('sha256').update(String(userId) + ':' + input.requestId).digest('hex')
  const hash = crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex')
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    // Serialize concurrent retries for this user/request.
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [String(userId) + ':' + id])
    const primary = await calendar.calendarList.get({ calendarId: 'primary' }, { timeout: 15000 })
    const calendarId = primary.data.id
    const key = calendarId + ':' + id
    let event
    try {
      event = (await calendar.events.insert({
        calendarId, requestBody: googleBody(data, id, hash), sendUpdates: 'none'
      }, { timeout: 20000, retry: false })).data
    } catch (error) {
      if (Number(error.code || error.response?.status) !== 409) throw error
      event = (await calendar.events.get({ calendarId, eventId: id }, { timeout: 15000 })).data
    }
    if (event.extendedProperties?.private?.scheduleChecklistHash !== hash) {
      throw Object.assign(new Error('この送信は別の内容で処理済みです。画面を開き直してください。'), { status: 409 })
    }
    const inserted = await client.query(
      `INSERT INTO events (user_id,google_event_id,title,description,location,start_datetime,end_datetime,is_all_day,is_deleted)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,false)
       ON CONFLICT (user_id,google_event_id) DO NOTHING RETURNING event_id`,
      [userId, key, data.title, data.description, data.location,
        event.start.dateTime?.slice(0,19) || event.start.date + 'T00:00:00',
        event.end.dateTime?.slice(0,19) || event.end.date + 'T00:00:00', data.allDay]
    )
    if (inserted.rows.length) {
      for (let i = 0; i < data.checklists.length; i++) {
        await client.query(
          `INSERT INTO checklists (user_id,event_id,title,target_date,is_completed,sort_order)
           VALUES ($1,$2,$3,$4,false,$5)`,
          [userId, key, data.checklists[i].title, data.date, i + 1]
        )
      }
    }
    await client.query('COMMIT')
    return { googleEventId: id, calendarId, date: data.date, title: data.title }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
module.exports = { createEvent, validateEvent, googleBody }
