import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pdfNoteTitle } from './pdfNoteTitle.js'
test('PDF titles use page numbers and retain explicit titles regardless of body', () => {
  assert.equal(
    pdfNoteTitle({ page: 1, question: '', body: 'very long translation' }, []),
    '1ページ ノート',
  )
  assert.equal(
    pdfNoteTitle({ page: 2, question: '問題6の解釈', body: 'changed' }, []),
    '問題6の解釈',
  )
})
test('same-page titles are numbered without colliding after deletions', () => {
  const entries = [
    { page: 1, question: '1ページ ノート' },
    { page: 1, question: '1ページ ノート 3' },
    { page: 2, question: '2ページ ノート' },
  ]
  assert.equal(pdfNoteTitle({ page: 1, question: '' }, entries), '1ページ ノート 4')
  assert.equal(pdfNoteTitle({ page: 3, question: '' }, entries), '3ページ ノート')
})
