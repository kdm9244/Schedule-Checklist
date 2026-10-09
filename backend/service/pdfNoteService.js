const dao = require('../database/DAO')
const files = require('./pdfNoteFiles')
const { fail, identifier, pageNumber, title, entry } = require('../utils/pdfNoteValidation')
async function owned(db, userId, noteId, lock = false) {
  const row = (
    await db.query(
      'SELECT * FROM pdf_notes WHERE note_id=$1 AND user_id=$2' + (lock ? ' FOR UPDATE' : ''),
      [identifier(noteId), userId],
    )
  ).rows[0]
  if (!row) throw fail(404, 'PDFノートが見つかりません。')
  return row
}
async function links(db, userId, input) {
  let task = null,
    milestone = null,
    roadmap = null
  if (input.task_id) {
    task = (
      await db.query('SELECT * FROM learning_tasks WHERE task_id=$1 AND user_id=$2', [
        identifier(input.task_id),
        userId,
      ])
    ).rows[0]
    if (!task) throw fail(400, 'やることを確認してください。')
  }
  const milestoneId = input.milestone_id || task?.milestone_id
  if (milestoneId) {
    milestone = (
      await db.query('SELECT * FROM learning_milestones WHERE milestone_id=$1 AND user_id=$2', [
        identifier(milestoneId),
        userId,
      ])
    ).rows[0]
    if (!milestone || (task && String(task.milestone_id) !== String(milestone.milestone_id)))
      throw fail(400, '小さな目標を確認してください。')
  }
  const roadmapId = input.roadmap_id || milestone?.roadmap_id
  if (roadmapId) {
    roadmap = (
      await db.query('SELECT * FROM learning_roadmaps WHERE roadmap_id=$1 AND user_id=$2', [
        identifier(roadmapId),
        userId,
      ])
    ).rows[0]
    if (!roadmap || (milestone && String(milestone.roadmap_id) !== String(roadmap.roadmap_id)))
      throw fail(400, '学習目標を確認してください。')
  }
  return {
    roadmap_id: roadmap?.roadmap_id || null,
    milestone_id: milestone?.milestone_id || null,
    task_id: task?.task_id || null,
  }
}
async function library(userId, input = {}, db = dao) {
  const values = [userId],
    bind = (value) => {
      values.push(value)
      return '$' + values.length
    },
    where = ['user_id=$1']
  for (const field of ['task_id', 'milestone_id', 'roadmap_id'])
    if (input[field]) where.push(`${field}=${bind(identifier(input[field]))}`)
  const scopeCondition = where.join(' AND '),
    scopeValues = [...values]
  if (input.order && !['newest', 'oldest'].includes(input.order))
    throw fail(400, '並び順を確認してください。')
  if (input.from && input.to && input.from > input.to)
    throw fail(400, '日付の範囲を確認してください。')
  if (input.kind && !['all', 'regular', 'pdf'].includes(input.kind))
    throw fail(400, 'ノートの種類を確認してください。')
  if (input.mode && !['plain', 'markdown'].includes(input.mode))
    throw fail(400, '入力形式を確認してください。')
  if (input.kind && input.kind !== 'all') where.push(`kind=${bind(input.kind)}`)
  if (input.mode) where.push(`input_mode=${bind(input.mode)}`)
  const q = String(input.q || '').trim()
  if (q.length > 200) throw fail(400, '検索は200文字以内で入力してください。')
  if (q) where.push(`search_body ILIKE ${bind('%' + q.replace(/[\\%_]/g, '\\$&') + '%')}`)
  for (const field of ['from', 'to'])
    if (input[field]) {
      if (!require('../utils/validation').validDate(input[field]))
        throw fail(400, '日付を確認してください。')
      where.push(`study_date ${field === 'from' ? '>=' : '<='} ${bind(input[field])}::date`)
    }
  const union = `WITH library AS (
 SELECT r.record_id::text AS item_id,'regular'::text AS kind,r.user_id,r.milestone_id,r.task_id,m.roadmap_id,r.title,r.study_date,r.input_mode,r.created_at, NULL::integer AS file_size,NULL::integer AS last_page,r.title||' '||r.body_markdown AS search_body FROM learning_records r LEFT JOIN learning_milestones m ON m.milestone_id=r.milestone_id AND m.user_id=r.user_id
 UNION ALL
 SELECT n.note_id::text,'pdf',n.user_id,n.milestone_id,n.task_id,n.roadmap_id,n.title,(n.created_at AT TIME ZONE 'Asia/Tokyo')::date,'pdf',n.created_at,n.file_size,n.last_page,n.title||' '||COALESCE((SELECT string_agg(e.question||' '||e.interpretation||' '||(CASE WHEN e.body_format='richtext' THEN regexp_replace(e.solution,'<[^>]*>','','g') ELSE e.solution END)||' '||e.review,' ') FROM pdf_note_entries e WHERE e.note_id=n.note_id),'') FROM pdf_notes n
 )`
  const condition = where.join(' AND '),
    total = Number(
      (await db.query(`${union} SELECT count(*) FROM library WHERE ${condition}`, values)).rows[0]
        .count,
    )
  const pages = Math.max(1, Math.ceil(total / 8)),
    requested = Number(input.page || 1)
  if (!Number.isInteger(requested) || requested < 1) throw fail(400, 'ページを確認してください。')
  const current = Math.min(requested, pages),
    direction = input.order === 'oldest' ? 'ASC' : 'DESC'
  const items = (
    await db.query(
      `${union} SELECT item_id,kind,title,study_date::text,input_mode,file_size,last_page FROM library WHERE ${condition} ORDER BY study_date ${direction},created_at ${direction},kind,item_id::bigint ${direction} LIMIT 8 OFFSET ${bind((current - 1) * 8)}`,
      values,
    )
  ).rows
  const available = Number(
    (await db.query(`${union} SELECT count(*) FROM library WHERE ${scopeCondition}`, scopeValues))
      .rows[0].count,
  )
  return { items, total, page: current, pages, available }
}
async function list(userId, db = dao) {
  return (
    await db.query(
      'SELECT note_id,title,file_size,roadmap_id,milestone_id,task_id,last_page,created_at FROM pdf_notes WHERE user_id=$1 ORDER BY note_id DESC',
      [userId],
    )
  ).rows
}
async function get(userId, noteId, db = dao) {
  const note = await owned(db, userId, noteId)
  delete note.file_key
  return {
    note,
    entries: (
      await db.query('SELECT * FROM pdf_note_entries WHERE note_id=$1 ORDER BY page,entry_id', [
        note.note_id,
      ])
    ).rows,
  }
}
async function create(userId, bytes, input, db = dao) {
  files.validate(bytes)
  const name = title(input.title),
    related = await links(db, userId, input),
    key = await files.write(bytes)
  try {
    return (
      await db.query(
        'INSERT INTO pdf_notes(user_id,title,file_key,file_size,roadmap_id,milestone_id,task_id) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING note_id',
        [
          userId,
          name,
          key,
          bytes.length,
          related.roadmap_id,
          related.milestone_id,
          related.task_id,
        ],
      )
    ).rows[0]
  } catch (error) {
    await files.discard(key)
    throw error
  }
}
async function update(userId, noteId, input, db = dao) {
  const client = await db.pool.connect()
  try {
    await client.query('BEGIN')
    const previous = await owned(client, userId, noteId, true)
    const allowed = ['title', 'roadmap_id', 'milestone_id', 'task_id', 'last_page']
    if (Object.keys(input).some((k) => !allowed.includes(k)))
      throw fail(400, '変更する項目を確認してください。')
    const hasLinks = ['roadmap_id', 'milestone_id', 'task_id'].some((k) => Object.hasOwn(input, k))
    let related = {
      roadmap_id: previous.roadmap_id,
      milestone_id: previous.milestone_id,
      task_id: previous.task_id,
    }
    if (hasLinks) {
      const next = { ...related, ...input }
      if (
        Object.hasOwn(input, 'milestone_id') &&
        String(input.milestone_id || '') !== String(previous.milestone_id || '')
      ) {
        if (!Object.hasOwn(input, 'task_id')) next.task_id = null
        if (!Object.hasOwn(input, 'roadmap_id')) next.roadmap_id = null
      }
      related = await links(client, userId, next)
    }
    const row = (
      await client.query(
        'UPDATE pdf_notes SET title=$1,roadmap_id=$2,milestone_id=$3,task_id=$4,last_page=$5 WHERE note_id=$6 AND user_id=$7 RETURNING *',
        [
          input.title === undefined ? previous.title : title(input.title),
          related.roadmap_id,
          related.milestone_id,
          related.task_id,
          input.last_page === undefined ? previous.last_page : pageNumber(input.last_page),
          noteId,
          userId,
        ],
      )
    ).rows[0]
    await client.query('COMMIT')
    delete row.file_key
    return row
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
async function saveEntry(userId, noteId, entryId, input, db = dao) {
  await owned(db, userId, noteId)
  const e = entry(input),
    values = [
      e.question,
      e.page,
      e.interpretation,
      e.solution,
      e.review,
      e.status,
      e.body_format || 'plain',
    ]
  if (!entryId)
    return (
      await db.query(
        'INSERT INTO pdf_note_entries(question,page,interpretation,solution,review,status,body_format,note_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
        [...values, noteId],
      )
    ).rows[0]
  const row = (
    await db.query(
      'UPDATE pdf_note_entries SET question=$1,page=$2,interpretation=$3,solution=$4,review=$5,status=$6,body_format=$7,updated_at=now() WHERE note_id=$8 AND entry_id=$9 RETURNING *',
      [...values, noteId, identifier(entryId)],
    )
  ).rows[0]
  if (!row) throw fail(404, 'ノートが見つかりません。')
  return row
}
async function removeEntry(userId, noteId, entryId, db = dao) {
  await owned(db, userId, noteId)
  await db.query('DELETE FROM pdf_note_entries WHERE note_id=$1 AND entry_id=$2', [
    noteId,
    identifier(entryId),
  ])
  return { ok: true }
}
async function remove(userId, noteId, db = dao) {
  const client = await db.pool.connect()
  let moved = [],
    committed = false
  try {
    await client.query('BEGIN')
    const note = await owned(client, userId, noteId, true)
    moved = await files.stageRemoval(note.file_key)
    await client.query('DELETE FROM pdf_notes WHERE note_id=$1 AND user_id=$2', [
      note.note_id,
      userId,
    ])
    await client.query('COMMIT')
    committed = true
    await files.finish(moved)
    return { ok: true }
  } catch (error) {
    if (!committed) {
      await client.query('ROLLBACK')
      await files.restore(moved)
    }
    throw error
  } finally {
    client.release()
  }
}
module.exports = {
  owned,
  links,
  list,
  library,
  get,
  create,
  update,
  saveEntry,
  removeEntry,
  remove,
}
