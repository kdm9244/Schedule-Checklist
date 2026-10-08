import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pdfEntryBody, pdfEntryPayload } from './pdfNotes.js'
test('free-form PDF notes preserve all earlier sections and drafts', () => {
  const old = { interpretation: '訳', solution: '答え', review: '見直す' }
  const body = pdfEntryBody(old)
  for (const text of Object.values(old)) assert.ok(body.includes(text))
  const payload = pdfEntryPayload({ question: '問1', page: 5, body, status: 'review' })
  assert.equal(pdfEntryBody(payload), body)
  assert.equal(payload.status, 'review')
  assert.equal(pdfEntryBody({ body: '自由なメモ', ...old }), '自由なメモ')
})
