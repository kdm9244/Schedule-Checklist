import { test } from 'node:test'
import assert from 'node:assert/strict'
import { descriptionParts,editDraft,editPayload } from './eventDetail.js'
test('plain description URLs become links while preserving text and line breaks',()=>{
  const text='강의 https://paiza.jp/for_teams\n자료 https://example.com/path?a=1&b=2'
  const parts=descriptionParts(text)
  assert.equal(parts.map(part=>part.text).join(''),text)
  assert.deepEqual(parts.filter(part=>part.url).map(part=>part.url),['https://paiza.jp/for_teams','https://example.com/path?a=1&b=2'])
})
test('URL punctuation is kept as prose and balanced URL parentheses are retained',()=>{
  const text='(https://example.com/a). https://example.com/wiki/Test_(one)'
  const parts=descriptionParts(text)
  assert.equal(parts.map(part=>part.text).join(''),text)
  assert.deepEqual(parts.filter(part=>part.url).map(part=>part.url),['https://example.com/a','https://example.com/wiki/Test_(one)'])
})
test('unsafe schemes and invalid URLs remain plain text',()=>{
  const text='javascript:alert(1) data:text/html,test https://'
  assert.deepEqual(descriptionParts(text),[{text}])
  assert.deepEqual(descriptionParts(''),[])
})
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
