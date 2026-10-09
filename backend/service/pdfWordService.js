const dao = require('../database/DAO')
const { owned } = require('./pdfNoteService')
const { fail, identifier, pageNumber } = require('../utils/pdfNoteValidation')

function validate(input) {
  if (!input || typeof input !== 'object') throw fail(400, '単語の入力を確認してください。')
  const result = { page: pageNumber(input.page) }
  for (const [key, limit] of [
    ['word', 200],
    ['reading', 200],
    ['meaning', 1000],
  ]) {
    if (typeof input[key] !== 'string') throw fail(400, '単語の入力を確認してください。')
    result[key] = input[key].normalize('NFKC').replace(/\s+/g, ' ').trim()
    if (result[key].length > limit || (key !== 'reading' && !result[key]))
      throw fail(400, '単語と意味は必須です。単語・読み方は200文字、意味は1000文字以内です。')
  }
  return result
}
async function list(userId, noteId) {
  await owned(dao, userId, noteId)
  return (
    await dao.query('SELECT * FROM pdf_note_words WHERE note_id=$1 ORDER BY word_id', [noteId])
  ).rows
}
async function save(userId, noteId, wordId, input) {
  const value = validate(input),
    { wordKey } = require('./wordLibraryService')
  if (wordId) wordId = identifier(wordId)
  const client = await dao.pool.connect()
  try {
    await client.query('BEGIN')
    await owned(client, userId, noteId, true)
    if (
      wordId &&
      !(
        await client.query('SELECT word_id FROM pdf_note_words WHERE note_id=$1 AND word_id=$2', [
          noteId,
          wordId,
        ])
      ).rowCount
    )
      throw fail(404, '単語が見つかりません。')
    const existing = (
      await client.query('SELECT * FROM pdf_note_words WHERE note_id=$1 AND page=$2', [
        noteId,
        value.page,
      ])
    ).rows
    if (
      existing.some(
        (row) => String(row.word_id) !== String(wordId) && wordKey(row) === wordKey(value),
      )
    )
      throw fail(409, '同じPDFのこのページには既に同じ単語があります。')
    const params = [noteId, value.word, value.reading, value.meaning, value.page]
    const result = wordId
      ? await client.query(
          'UPDATE pdf_note_words SET word=$2,reading=$3,meaning=$4,page=$5,updated_at=now() WHERE note_id=$1 AND word_id=$6 RETURNING *',
          [...params, wordId],
        )
      : await client.query(
          'INSERT INTO pdf_note_words(note_id,word,reading,meaning,page) VALUES($1,$2,$3,$4,$5) RETURNING *',
          params,
        )
    await client.query('COMMIT')
    return result.rows[0]
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
async function remove(userId, noteId, wordId) {
  await owned(dao, userId, noteId)
  const result = await dao.query(
    'DELETE FROM pdf_note_words WHERE note_id=$1 AND word_id=$2 RETURNING word_id',
    [noteId, identifier(wordId)],
  )
  if (!result.rows[0]) throw fail(404, '単語が見つかりません。')
  return { ok: true }
}
module.exports = { list, save, remove, validate }
