const { test } = require('node:test')
const assert = require('node:assert/strict')
const { randomUUID } = require('node:crypto')
const { createEvent, validateEvent, googleBody } = require('../service/eventCreateService')
const { validDate } = require('../utils/validation')
const { getDateRange, createCalendar } = require('../service/calendarService')

const input = overrides => ({
  title: 'Test event', date: '2026-09-17', allDay: false, startTime: '09:00', endTime: '10:00',
  location: '', description: '', timeZone: 'Asia/Tokyo', checklists: [{ title: 'A' }, { title: 'B' }],
  requestId: randomUUID(), ...overrides
})
function boundary() {
  const googleEvents = new Map()
  let committed = { events: [], checklists: [] }, tx, failChecklist = false
  const calls = []
  const calendar = {
    calendarList: { get: async () => ({ data: { id: 'test@example.invalid' } }) },
    events: {
      insert: async ({ requestBody }) => {
        if (googleEvents.has(requestBody.id)) throw Object.assign(new Error('exists'), { code: 409 })
        googleEvents.set(requestBody.id, requestBody)
        return { data: requestBody }
      },
      get: async ({ eventId }) => ({ data: googleEvents.get(eventId) })
    }
  }
  const client = {
    query: async (sql, values) => {
      calls.push(sql)
      if (sql === 'BEGIN') tx = structuredClone(committed)
      if (sql === 'COMMIT') committed = tx
      if (sql === 'ROLLBACK') tx = undefined
      if (sql.startsWith('INSERT INTO events')) {
        if (tx.events.some(e => e[0] === values[0] && e[1] === values[1])) return { rows: [] }
        tx.events.push(values)
        return { rows: [{ event_id: 1 }] }
      }
      if (sql.startsWith('INSERT INTO checklists')) {
        if (failChecklist) { failChecklist = false; throw new Error('simulated DB failure') }
        tx.checklists.push(values)
      }
      return { rows: [] }
    },
    release: () => calls.push('release')
  }
  return {
    calendar, pool: { connect: async () => client }, googleEvents, calls,
    state: () => committed, failNextChecklist: () => { failChecklist = true }
  }
}
test('strict calendar dates including leap years', () => {
  assert.equal(validDate('2024-02-29'), true)
  for (const date of ['2026-02-29', '2026-04-31', '2026-13-01', 'bad', null]) assert.equal(validDate(date), false)
})
test('invalid range and oversized range rejected', () => {
  assert.throws(() => getDateRange({ startDate:'2026-09-18', endDate:'2026-09-17' }))
  assert.throws(() => getDateRange({ startDate:'2026-01-01', endDate:'2026-12-31' }))
  const { start, end } = getDateRange({ date:'2026-09-17' })
  assert.equal(end.getDate(), 18); assert.equal(start.getDate(), 17)
})
test('OAuth clients are isolated between users', () => {
  assert.notEqual(createCalendar({}).context._options.auth, createCalendar({}).context._options.auth)
})
test('input validation rejects malformed payloads', () => {
  for (const change of [{ title:'' }, { date:'2026-02-30' }, { endTime:'08:00' }, { startTime:'25:00' },
    { checklists:[null] }, { checklists:[{ title:'' }] }, { requestId:'-'.repeat(36) }, { timeZone:'invalid/zone' }]) {
    assert.throws(() => validateEvent(input(change)), error => error.status === 400)
  }
})
test('all-day uses exclusive end date over year boundary', () => {
  const result = googleBody(validateEvent(input({ date:'2026-12-31', allDay:true })), 'id', 'hash')
  assert.deepEqual(result.start, { date:'2026-12-31' })
  assert.deepEqual(result.end, { date:'2027-01-01' })
})
test('timed event preserves explicit timezone', () => {
  const result = googleBody(validateEvent(input()), 'id', 'hash')
  assert.deepEqual(result.start, { dateTime:'2026-09-17T09:00:00', timeZone:'Asia/Tokyo' })
})
test('create persists ordered checklists and composite Google ID', async () => {
  const deps = boundary(), payload = input()
  const result = await createEvent(42, {}, payload, deps)
  assert.equal(deps.googleEvents.size, 1)
  assert.equal(deps.state().events.length, 1)
  assert.equal(deps.state().events[0][1], result.calendarId + ':' + result.googleEventId)
  assert.deepEqual(deps.state().checklists.map(row => [row[2], row[4]]), [['A',1],['B',2]])
  assert.equal(deps.calls.at(-1), 'release')
})
test('retry after lost response does not duplicate Google or DB rows', async () => {
  const deps = boundary(), payload = input()
  const first = await createEvent(42, {}, payload, deps)
  const retry = await createEvent(42, {}, payload, deps)
  assert.deepEqual(retry, first)
  assert.equal(deps.googleEvents.size, 1)
  assert.equal(deps.state().events.length, 1)
  assert.equal(deps.state().checklists.length, 2)
})
test('DB failure rolls back; retry repairs DB without duplicate Google event', async () => {
  const deps = boundary(), payload = input()
  deps.failNextChecklist()
  await assert.rejects(createEvent(42, {}, payload, deps), /simulated DB failure/)
  assert.equal(deps.googleEvents.size, 1)
  assert.equal(deps.state().events.length, 0)
  assert.ok(deps.calls.includes('ROLLBACK'))
  await createEvent(42, {}, payload, deps)
  assert.equal(deps.googleEvents.size, 1)
  assert.equal(deps.state().checklists.length, 2)
})
test('same request ID with changed content rejected', async () => {
  const deps = boundary(), payload = input()
  await createEvent(42, {}, payload, deps)
  await assert.rejects(createEvent(42, {}, { ...payload, title:'changed' }, deps), error => error.status === 409)
})
test('Google permission failure leaves no DB record', async () => {
  const deps = boundary()
  deps.calendar.events.insert = async () => { throw Object.assign(new Error('forbidden'), { code:403 }) }
  await assert.rejects(createEvent(42, {}, input(), deps), /forbidden/)
  assert.equal(deps.state().events.length, 0)
  assert.equal(deps.calls.at(-1), 'release')
})
