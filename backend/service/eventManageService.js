const crypto = require('node:crypto')
const { createCalendar } = require('./calendarService')
const dao = require('../database/DAO')
const { validDate, badRequest } = require('../utils/validation')
const fail = (status, message) => Object.assign(new Error(message), { status })
const options = { timeout: 20000, retry: false }
function target(input) {
  if (!input || ['calendarId','eventId'].some(k => typeof input[k] !== 'string' || !input[k] || input[k].length > 1000)) throw badRequest('予定を選択してください。')
  return { calendarId: input.calendarId, eventId: input.eventId }
}
function writable(calendar, event) {
  return ['owner','writer'].includes(calendar.accessRole) && !event.locked &&
    (!event.eventType || event.eventType === 'default') && !event.recurrence &&
    (event.organizer?.self !== false || event.guestsCanModify === true)
}
async function context(tokens, input, deps) {
  const ids = target(input), api = deps.calendar || createCalendar(tokens)
  const calendar = (await api.calendarList.get({ calendarId:ids.calendarId }, options)).data
  // Canonical ID avoids separate DB identities for "primary" and the actual calendar.
  ids.calendarId = calendar.id
  return { api, calendar, ids, key:ids.calendarId + ':' + ids.eventId }
}
function validatePatch(input) {
  if (!input || typeof input !== 'object') throw badRequest('入力内容を確認してください。')
  const body = {}
  for (const [key,max] of [['summary',255],['location',255],['description',20000]]) {
    if (typeof input[key] !== 'string' || input[key].length > max || (key === 'summary' && !input[key].trim())) throw badRequest('予定名・場所・説明の長さを確認してください。')
    body[key] = input[key]
  }
  const start = input.start, end = input.end
  if (!start || !end) throw badRequest('開始と終了を入力してください。')
  if (start.date && end.date && !start.dateTime && !end.dateTime) {
    if (!validDate(start.date) || !validDate(end.date) || start.date >= end.date) throw badRequest('終了日を確認してください。')
    body.start = { date:start.date, dateTime:null, timeZone:null }; body.end = { date:end.date, dateTime:null, timeZone:null }
  } else {
    const validTime = value => typeof value === 'string' &&
      /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(value) &&
      validDate(value.slice(0,10)) && Number.isFinite(Date.parse(value))
    if (start.date || end.date || !validTime(start.dateTime) || !validTime(end.dateTime) || Date.parse(start.dateTime) >= Date.parse(end.dateTime)) throw badRequest('終了日時は開始日時より後にしてください。')
    body.start = { date:null, dateTime:start.dateTime }; body.end = { date:null, dateTime:end.dateTime }
    for (const name of ['start','end']) if (input[name].timeZone) {
      try { new Intl.DateTimeFormat('ja', { timeZone:input[name].timeZone }).format() } catch { throw badRequest('タイムゾーンが無効です。') }
      body[name].timeZone = input[name].timeZone
    }
  }
  return body
}
async function mirror(db, userId, key, event) {
  await db.query(
    `INSERT INTO events (user_id,google_event_id,title,description,location,start_datetime,end_datetime,is_all_day,is_deleted)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,false)
     ON CONFLICT (user_id,google_event_id) DO UPDATE SET title=EXCLUDED.title,description=EXCLUDED.description,
     location=EXCLUDED.location,start_datetime=EXCLUDED.start_datetime,end_datetime=EXCLUDED.end_datetime,
     is_all_day=EXCLUDED.is_all_day,is_deleted=false,updated_at=CURRENT_TIMESTAMP`,
    [userId,key,event.summary || 'タイトルなし',event.description || '',event.location || '',
      event.start.dateTime?.slice(0,19) || event.start.date + 'T00:00:00',
      event.end.dateTime?.slice(0,19) || event.end.date + 'T00:00:00',Boolean(event.start.date)]
  )
}
async function getEvent(userId, tokens, input, deps = {}) {
  if (!deps.db) await require('./checklistSchemaService').ensureSchema()
  const { api, calendar, ids, key } = await context(tokens,input,deps)
  const event = (await api.events.get(ids,options)).data
  if (event.status === 'cancelled') throw fail(410,'この予定は削除されています。')
  const rows = await (deps.db || dao).query(
    'SELECT checklist_id,event_id,title,target_date,is_completed,sort_order FROM checklists WHERE user_id=$1 AND event_id=ANY($2::varchar[]) ORDER BY sort_order,checklist_id',
    [userId,[key,ids.eventId]]
  )
  return { ...event, calendarId:ids.calendarId, calendarName:calendar.summary,
    canEdit:writable(calendar,event), checklists:rows.rows }
}
async function updateEvent(userId, tokens, input, deps = {}) {
  const patch = validatePatch(input)
  if (typeof input.etag !== 'string' || !input.etag || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(input.operationId || '')) throw badRequest('予定を読み直してください。')
  const { api, calendar, ids, key } = await context(tokens,input,deps)
  let event = (await api.events.get(ids,options)).data
  if (event.status === 'cancelled') throw fail(410,'この予定は削除されています。')
  if (!writable(calendar,event)) throw fail(403,'この予定は閲覧のみです。繰り返し予定は1回分を選択してください。')
  const hash = crypto.createHash('sha256').update(String(userId) + JSON.stringify(patch)).digest('hex')
  const previous = event.extendedProperties?.private || {}
  if (previous.plannerOperation === input.operationId) {
    if (previous.plannerHash !== hash) throw fail(409,'再試行の内容が変わっています。予定を読み直してください。')
  } else {
    if (event.etag !== input.etag) throw fail(412,'他の画面で変更されています。入力を控えて、最新の予定を読み直してください。')
    // Patch only supported fields, preserving attendees, conferencing and recurrence metadata.
    event = (await api.events.patch({
      ...ids, requestBody:{ ...patch, extendedProperties:{ private:{ ...previous,plannerOperation:input.operationId,plannerHash:hash } } },
      sendUpdates:'all'
    }, { ...options, headers:{ 'If-Match':input.etag } })).data
  }
  // If DB fails after Google succeeds, the same operation can retry this mirror safely.
  await mirror(deps.db || dao,userId,key,event)
  return { ...event, calendarId:ids.calendarId, canEdit:true }
}
async function deleteEvent(userId, tokens, input, deps = {}) {
  if (!input || typeof input.etag !== 'string' || !input.etag) throw badRequest('予定を読み直してください。')
  const { api, calendar, ids, key } = await context(tokens,input,deps)
  if (!['owner','writer'].includes(calendar.accessRole)) throw fail(403,'このカレンダーは閲覧のみです。')
  const db = deps.db || dao
  let event
  try { event = (await api.events.get(ids,options)).data } catch (error) {
    // 404 can also mean lost access; only 410 is a confirmed deletion.
    if (Number(error.code || error.response?.status) !== 410) throw error
  }
  if (event && event.status !== 'cancelled') {
    if (!writable(calendar,event)) throw fail(403,'この予定は削除できません。繰り返し予定は1回分を選択してください。')
    if (event.etag !== input.etag) throw fail(412,'予定が変更されています。最新の内容を確認してから削除してください。')
    // Persist a snapshot first so a retry can archive even after Google returns 410.
    await mirror(db,userId,key,event)
    try { await api.events.delete({ ...ids, sendUpdates:'all' }, { ...options, headers:{ 'If-Match':input.etag } }) }
    catch (error) { if (Number(error.code || error.response?.status) !== 410) throw error }
  }
  await db.query('UPDATE events SET is_deleted=true,updated_at=CURRENT_TIMESTAMP WHERE user_id=$1 AND google_event_id=$2',[userId,key])
  // Deliberately keep checklist rows, completion, general tasks and daily memos.
  return { deleted:true, calendarId:ids.calendarId, eventId:ids.eventId }
}
module.exports = { getEvent, updateEvent, deleteEvent, validatePatch, writable }
