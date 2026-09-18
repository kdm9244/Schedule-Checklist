import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mapEvent, occursOn, validDate, toCalendarInput } from './calendar.js'
test('multi-day all-day event includes all occupied days, excludes end date', () => {
  const event = mapEvent({ id:'a', calendarId:'c', start:{ date:'2026-09-17' }, end:{ date:'2026-09-20' } })
  assert.equal(event.key, 'c:a')
  for (const day of ['17','18','19']) assert.equal(occursOn(event,'2026-09-' + day), true)
  assert.equal(occursOn(event,'2026-09-20'), false)
})
test('timed midnight exclusive end and overnight continuation', () => {
  const event = { allDay:false, start:'2026-09-17T22:00:00', end:'2026-09-19T00:00:00' }
  assert.equal(occursOn(event,'2026-09-17'), true)
  assert.equal(occursOn(event,'2026-09-18'), true)
  assert.equal(occursOn(event,'2026-09-19'), false)
})
test('date validation rejects impossible query dates', () => {
  assert.equal(validDate('2026-02-30'),false)
  assert.equal(validDate('2024-02-29'),true)
})
test('display labels never become FullCalendar recurring events', () => {
  const event = mapEvent({ id:'a',start:{dateTime:'2026-09-17T10:00:00+09:00'},end:{dateTime:'2026-09-17T11:00:00+09:00'} })
  const input = toCalendarInput(event)
  assert.equal('startTime' in input, false)
  assert.equal('endTime' in input, false)
  assert.equal(input.start, '2026-09-17T10:00:00+09:00')
})
test('calendar color is preserved for list and month views', () => {
  const event = mapEvent({ id:'a',calendarId:'work',calendarColor:'#8b5eb5',calendarForegroundColor:'#ffffff',start:{date:'2026-09-17'},end:{date:'2026-09-18'} })
  assert.equal(event.calendarColor,'#8b5eb5')
  assert.equal(toCalendarInput(event).backgroundColor,'#8b5eb5')
})
