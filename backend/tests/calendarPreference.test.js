const { test } = require('node:test')
const assert = require('node:assert/strict')
const { normalizeVisibility } = require('../service/calendarPreferenceService')
const { fallbackColor } = require('../service/calendarService')

test('calendar visibility accepts a scoped calendar id and boolean', () => {
  assert.deepEqual(normalizeVisibility({calendarId:' team@example.com ',visible:false}), {
    calendarId:'team@example.com',visible:false
  })
})

test('calendar visibility rejects malformed input', () => {
  assert.throws(() => normalizeVisibility({calendarId:'',visible:true}), /INVALID_CALENDAR_PREFERENCE/)
  assert.throws(() => normalizeVisibility({calendarId:'calendar',visible:'false'}), /INVALID_CALENDAR_PREFERENCE/)
})

test('fallback calendar colors are stable', () => {
  assert.equal(fallbackColor('calendar-a'),fallbackColor('calendar-a'))
  assert.match(fallbackColor('calendar-a'),/^#[0-9a-f]{6}$/i)
})
