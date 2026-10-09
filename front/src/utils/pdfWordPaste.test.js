import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseWordPaste } from './pdfWordPaste.js'
const expected = { word: '個人会員向け', reading: 'こじんかいいんむけ', meaning: '개인 회원 대상' }
test('copied table rows preserve spaces in Korean meanings', () => {
  for (const value of [
    '個人会員向け\tこじんかいいんむけ\t개인 회원 대상',
    '個人会員向け\nこじんかいいんむけ\n개인 회원 대상',
    '個人会員向け こじんかいいんむけ 개인 회원 대상',
  ])
    assert.deepEqual(parseWordPaste(value), expected)
})
test('kana words and omitted readings are supported', () => {
  assert.deepEqual(parseWordPaste('サービス\t\t서비스'), {
    word: 'サービス',
    reading: '',
    meaning: '서비스',
  })
  assert.deepEqual(parseWordPaste('サービス 서비스'), {
    word: 'サービス',
    reading: '',
    meaning: '서비스',
  })
  assert.deepEqual(parseWordPaste('サービス\tサービス\t서비스'), {
    word: 'サービス',
    reading: 'サービス',
    meaning: '서비스',
  })
})
test('empty input is ignored and malformed or multiple rows cannot be saved', () => {
  assert.equal(parseWordPaste(' \n'), null)
  for (const value of ['単語', '単語\tよみ\t', 'a\tb\tc\nd\te\tf', 'a\tb\tc\td'])
    assert.throws(() => parseWordPaste(value))
})
