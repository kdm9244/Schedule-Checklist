const { test } = require('node:test')
const assert = require('node:assert/strict')
const { normalize } = require('../service/checklistTemplateService')

test('recurring checklist normalizes title and weekday order', () => {
  assert.deepEqual(normalize({ title:'  Daily review  ',daysOfWeek:[5,1,1,3] }), {
    title:'Daily review',daysOfWeek:[1,3,5]
  })
})

test('recurring checklist rejects empty or invalid weekday settings', () => {
  assert.throws(() => normalize({title:'Task',daysOfWeek:[]}), /INVALID_TEMPLATE/)
  assert.throws(() => normalize({title:'Task',daysOfWeek:[7]}), /INVALID_TEMPLATE/)
  assert.throws(() => normalize({title:' ',daysOfWeek:[1]}), /INVALID_TEMPLATE/)
})

test('partial recurring checklist update permits active-only changes', () => {
  assert.deepEqual(normalize({active:false},true), {active:false})
})

test('recurring checklist accepts only a valid start date', () => {
  assert.deepEqual(normalize({startDate:'2026-09-18'},true), {startDate:'2026-09-18'})
  assert.throws(() => normalize({startDate:'2026-02-30'},true), /INVALID_TEMPLATE/)
})
