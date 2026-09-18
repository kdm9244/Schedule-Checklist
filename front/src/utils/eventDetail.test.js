import { test } from 'node:test'
import assert from 'node:assert/strict'
import { editDraft,editPayload } from './eventDetail.js'
test('inclusive all-day editor round-trips exclusive Google end across year boundary',()=>{
  const event={summary:'Trip',start:{date:'2026-12-31'},end:{date:'2027-01-03'},description:'<u>Notes</u>'}
  const draft=editDraft(event,'Notes')
  assert.equal(draft.end,'2027-01-02')
  draft.summary='Updated'
  const result=editPayload(draft,event,'Notes')
  assert.deepEqual(result.end,event.end)
  assert.equal(result.description,'<u>Notes</u>')
})
test('unchanged timed fields retain seconds and timezone when editing title',()=>{
  const event={summary:'Meeting',start:{dateTime:'2026-09-18T10:00:37+09:00',timeZone:'Asia/Tokyo'},
    end:{dateTime:'2026-09-18T11:00:59+09:00',timeZone:'Asia/Tokyo'}}
  const draft=editDraft(event,'');draft.summary='Changed'
  const result=editPayload(draft,event,'')
  assert.deepEqual(result.start,event.start)
  assert.deepEqual(result.end,event.end)
})
test('edited description is plain text and invalid time range rejected',()=>{
  const event={summary:'Test',description:'<u>Old</u>',start:{dateTime:'2026-09-18T10:00:00+09:00'},end:{dateTime:'2026-09-18T11:00:00+09:00'}}
  const draft=editDraft(event,'Old');draft.description='New'
  assert.equal(editPayload(draft,event,'Old').description,'New')
  draft.end=draft.start
  assert.throws(()=>editPayload(draft,event,'Old'))
})
test('all-day edited final date is inclusive',()=>{
  const event={start:{date:'2026-09-18'},end:{date:'2026-09-19'}}
  const draft=editDraft(event,'');draft.end='2026-09-22'
  assert.equal(editPayload(draft,event,'').end.date,'2026-09-23')
})
