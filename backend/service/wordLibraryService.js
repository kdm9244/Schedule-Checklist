const db = require('../database/DAO')
const crypto = require('node:crypto')
const { fail, identifier } = require('../utils/pdfNoteValidation')
const normalize = (value) => value.normalize('NFKC').replace(/\s+/g, ' ').trim()
const wordKey = (value) =>
  JSON.stringify(['word', 'reading', 'meaning'].map((key) => normalize(value[key])))
const groupId = (value) => crypto.createHash('sha256').update(wordKey(value)).digest('hex')

async function rows(userId, client = db) {
  return (
    await client.query(
      `SELECT w.*,n.title AS pdf_title,n.roadmap_id,n.milestone_id,
    r.title AS roadmap_title,m.title AS milestone_title
    FROM pdf_note_words w JOIN pdf_notes n ON n.note_id=w.note_id
    LEFT JOIN learning_roadmaps r ON r.roadmap_id=n.roadmap_id
    LEFT JOIN learning_milestones m ON m.milestone_id=n.milestone_id
    WHERE n.user_id=$1 ORDER BY w.word_id`,
      [userId],
    )
  ).rows
}
function buildLibrary(all, query, paginate = true) {
  const filters = {}
  for (const key of ['roadmap_id', 'milestone_id', 'note_id'])
    if (query[key]) filters[key] = identifier(query[key])
  if (query.pdf_page) {
    const page = Number(query.pdf_page)
    if (!Number.isInteger(page) || page < 1 || page > 100000)
      throw fail(400, 'ページを確認してください。')
    filters.page = page
  }
  const search = normalize(String(query.q || ''))
  if (search.length > 200) throw fail(400, '検索は200文字以内です。')
  const sort = query.sort || 'recent'
  if (!['recent', 'word', 'reading', 'random'].includes(sort))
    throw fail(400, '並び順を確認してください。')
  const seed = String(query.seed || 'default')
  if (seed.length > 100) throw fail(400, '並び順を確認してください。')
  if (query.mastery && !['all', 'learned', 'unlearned'].includes(query.mastery))
    throw fail(400, '学習状態を確認してください。')
  const requested = Number(query.page || 1)
  if (!Number.isSafeInteger(requested) || requested < 1)
    throw fail(400, 'ページを確認してください。')
  const matches = (row, keys) =>
    keys.every((key) => !filters[key] || String(row[key]) === String(filters[key]))
  const options = (input, id, title) => [
    ...new Map(
      input
        .filter((row) => row[id])
        .map((row) => [String(row[id]), { id: String(row[id]), title: row[title] }]),
    ).values(),
  ]
  const facets = {
    roadmaps: options(all, 'roadmap_id', 'roadmap_title'),
    milestones: options(
      all.filter((r) => matches(r, ['roadmap_id'])),
      'milestone_id',
      'milestone_title',
    ),
    pdfs: options(
      all.filter((r) => matches(r, ['roadmap_id', 'milestone_id'])),
      'note_id',
      'pdf_title',
    ),
    pages: [
      ...new Set(
        all.filter((r) => matches(r, ['roadmap_id', 'milestone_id', 'note_id'])).map((r) => r.page),
      ),
    ].sort((a, b) => a - b),
  }
  const grouped = new Map()
  for (const row of all) {
    const id = groupId(row)
    if (!grouped.has(id))
      grouped.set(id, {
        id,
        word: row.word,
        reading: row.reading,
        meaning: row.meaning,
        sources: [],
        matching_source_ids: [],
        updated_at: row.updated_at,
        mastered: true,
      })
    const group = grouped.get(id)
    group.sources.push(row)
    group.mastered = group.mastered && row.mastered === true
    if (new Date(row.updated_at) > new Date(group.updated_at)) group.updated_at = row.updated_at
    if (matches(row, Object.keys(filters))) group.matching_source_ids.push(row.word_id)
  }
  const items = [...grouped.values()].filter(
    (group) =>
      group.matching_source_ids.length &&
      (!query.mastery ||
        query.mastery === 'all' ||
        group.mastered === (query.mastery === 'learned')) &&
      (!search ||
        normalize(`${group.word} ${group.reading} ${group.meaning}`)
          .toLocaleLowerCase()
          .includes(search.toLocaleLowerCase())),
  )
  items.sort((a, b) =>
    sort === 'random'
      ? crypto
          .createHash('sha256')
          .update(seed + a.id)
          .digest('hex')
          .localeCompare(
            crypto
              .createHash('sha256')
              .update(seed + b.id)
              .digest('hex'),
          )
      : sort === 'recent'
        ? new Date(b.updated_at) - new Date(a.updated_at) || a.id.localeCompare(b.id)
        : a[sort].localeCompare(b[sort], 'ja') || a.id.localeCompare(b.id),
  )
  const total = items.length,
    pages = Math.max(1, Math.ceil(total / 25)),
    page = Math.min(requested, pages)
  return {
    items: paginate ? items.slice((page - 1) * 25, page * 25) : items,
    total,
    page,
    pages,
    facets,
    source_count: items.reduce((count, item) => count + item.matching_source_ids.length, 0),
  }
}
async function library(userId, query) {
  return buildLibrary(await rows(userId), query)
}
async function resetMastery(userId, filters = {}) {
  const client = await db.pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(
      'SELECT note_id FROM pdf_notes WHERE user_id=$1 ORDER BY note_id FOR UPDATE',
      [userId],
    )
    const matched = buildLibrary(await rows(userId, client), { ...filters, page: 1 }, false).items
    const ids = matched.flatMap((item) =>
      item.sources.filter((source) => source.mastered).map((source) => source.word_id),
    )
    if (ids.length)
      await client.query(
        'UPDATE pdf_note_words SET mastered=false WHERE word_id=ANY($1::bigint[])',
        [ids],
      )
    await client.query('COMMIT')
    return {
      ok: true,
      count: matched.filter((item) => item.sources.some((source) => source.mastered)).length,
    }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
async function mutate(userId, input, remove = false, mastery = false) {
  if (!Array.isArray(input?.ids) || !input.ids.length || input.ids.length > 500)
    throw fail(400, '1〜500件の出典を選択してください。')
  const ids = [...new Set(input.ids.map(identifier))]
  let value
  if (mastery && typeof input.mastered !== 'boolean')
    throw fail(400, '学習状態を確認してください。')
  if (!remove && !mastery) value = require('./pdfWordService').validate({ ...input, page: 1 })
  const client = await db.pool.connect()
  try {
    await client.query('BEGIN')
    // Lock parent notes first, matching PDF word registration's lock order.
    await client.query(
      'SELECT n.note_id FROM pdf_notes n WHERE n.user_id=$1 AND n.note_id IN (SELECT note_id FROM pdf_note_words WHERE word_id=ANY($2::bigint[])) ORDER BY n.note_id FOR UPDATE',
      [userId, ids],
    )
    const selected = (
      await client.query(
        'SELECT w.* FROM pdf_note_words w JOIN pdf_notes n ON n.note_id=w.note_id WHERE n.user_id=$1 AND w.word_id=ANY($2::bigint[]) FOR UPDATE OF w',
        [userId, ids],
      )
    ).rows
    if (selected.length !== ids.length)
      throw fail(404, '出典が見つかりません。再読み込みしてください。')
    if (mastery)
      await client.query('UPDATE pdf_note_words SET mastered=$2 WHERE word_id=ANY($1::bigint[])', [
        ids,
        input.mastered,
      ])
    else if (remove)
      await client.query('DELETE FROM pdf_note_words WHERE word_id=ANY($1::bigint[])', [ids])
    else {
      const others = (
        await client.query(
          'SELECT * FROM pdf_note_words WHERE note_id=ANY($1::bigint[]) AND NOT(word_id=ANY($2::bigint[]))',
          [selected.map((r) => r.note_id), ids],
        )
      ).rows
      const seen = new Set(others.map((row) => `${row.note_id}:${row.page}:${wordKey(row)}`))
      for (const row of selected) {
        const key = `${row.note_id}:${row.page}:${wordKey(value)}`
        if (seen.has(key))
          throw fail(409, '同じPDF・ページに同じ単語が存在します。出典を確認してください。')
        seen.add(key)
      }
      await client.query(
        'UPDATE pdf_note_words SET word=$2,reading=$3,meaning=$4,updated_at=now() WHERE word_id=ANY($1::bigint[])',
        [ids, value.word, value.reading, value.meaning],
      )
    }
    await client.query('COMMIT')
    return { ok: true, count: ids.length }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
module.exports = { library, mutate, resetMastery, buildLibrary, wordKey, normalize }
