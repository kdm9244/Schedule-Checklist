const { sanitizeRichText } = require('./pdfRichText')
const fail = (status, message) => Object.assign(new Error(message), { status })
function identifier(value) {
  if (!/^[1-9]\d{0,17}$/.test(String(value))) throw fail(400, 'IDを確認してください。')
  return String(value)
}
function pageNumber(value) {
  if (!Number.isInteger(value) || value < 1 || value > 100000)
    throw fail(400, 'ページ番号を確認してください。')
  return value
}
function title(value) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 200)
    throw fail(400, 'タイトルは1〜200文字です。')
  return value.trim()
}
function entry(input) {
  const result = { page: pageNumber(input.page), status: input.status }
  if (!['draft', 'done', 'review'].includes(result.status))
    throw fail(400, '状態を確認してください。')
  for (const key of ['question', 'interpretation', 'solution', 'review']) {
    if (
      typeof input[key] !== 'string' ||
      input[key].length > (key === 'question' ? 200 : key === 'solution' ? 200000 : 50000)
    )
      throw fail(400, '入力の長さを確認してください。')
    result[key] = input[key]
  }
  const format = input.body_format || 'plain'
  if (!['plain', 'richtext'].includes(format)) throw fail(400, '本文の形式を確認してください。')
  if (input.body_format !== undefined) result.body_format = format
  if (format === 'richtext') result.solution = sanitizeRichText(result.solution)
  return result
}
module.exports = { fail, identifier, pageNumber, title, entry }
