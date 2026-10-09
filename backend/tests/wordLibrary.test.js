const { test } = require('node:test')
const assert = require('node:assert/strict')
const service = require('../service/wordLibraryService')
const word = (id, patch = {}) => ({
  word_id: String(id),
  note_id: String(id),
  page: 1,
  word: '販売',
  reading: 'はんばい',
  meaning: '판매',
  roadmap_id: '1',
  roadmap_title: 'AP',
  milestone_id: '2',
  milestone_title: 'DB',
  pdf_title: 'PDF ' + id,
  updated_at: new Date('2026-10-01'),
  ...patch,
})
test('library merges exact normalized words, retains sources and distinct meanings', () => {
  const result = service.buildLibrary(
    [word(1), word(2, { word: ' 販売 ' }), word(3, { meaning: '판매하다' })],
    {},
  )
  assert.equal(result.total, 2)
  assert.equal(result.items.find((i) => i.meaning === '판매').sources.length, 2)
})
test('dependent facets include populated goals only, filtering retains other matching word sources', () => {
  const result = service.buildLibrary([word(1), word(2, { roadmap_id: '3', milestone_id: '4' })], {
    roadmap_id: '1',
    q: '판매',
  })
  assert.equal(result.total, 1)
  assert.equal(result.items[0].sources.length, 2)
  assert.deepEqual(result.items[0].matching_source_ids, ['1'])
  assert.deepEqual(
    result.facets.milestones.map((i) => i.id),
    ['2'],
  )
  assert.deepEqual(
    result.facets.pdfs.map((i) => i.id),
    ['1'],
  )
  assert.throws(
    () => service.buildLibrary([], { sort: 'invalid' }),
    (e) => e.status === 400,
  )
})
test('library pagination applies after grouping and rejects malformed filters', () => {
  const result = service.buildLibrary(
    Array.from({ length: 28 }, (_, i) => word(i + 1, { meaning: '뜻' + i })),
    { page: '2' },
  )
  assert.equal(result.items.length, 3)
  assert.equal(result.total, 28)
  for (const query of [
    { page: '-1' },
    { pdf_page: '1.5' },
    { note_id: '1 OR 1=1' },
    { q: 'x'.repeat(201) },
  ])
    assert.throws(
      () => service.buildLibrary([], query),
      (e) => e.status === 400,
    )
})
test('word library routes require login', async () => {
  const app = require('express')()
  app.use(require('../router/wordLibraryRouter'))
  const server = app.listen(0, '127.0.0.1')
  await new Promise((r) => server.once('listening', r))
  try {
    assert.equal((await fetch(`http://127.0.0.1:${server.address().port}/`)).status, 401)
  } finally {
    await new Promise((r) => server.close(r))
  }
})
test('random order is stable across pages, changes with seed, and mastery filters grouped words', () => {
  const input = Array.from({ length: 60 }, (_, i) =>
    word(i + 1, { meaning: '뜻' + i, mastered: i % 2 === 0 }),
  )
  const first = service.buildLibrary(input, { sort: 'random', seed: 'a' })
  assert.equal(service.buildLibrary(input, { mastery: 'learned' }, false).items.length, 30)
  assert.deepEqual(
    first.items.map((i) => i.id),
    service.buildLibrary(input, { sort: 'random', seed: 'a' }).items.map((i) => i.id),
  )
  assert.notDeepEqual(
    first.items.map((i) => i.id),
    service.buildLibrary(input, { sort: 'random', seed: 'b' }).items.map((i) => i.id),
  )
  const second = service.buildLibrary(input, { sort: 'random', seed: 'a', page: 2 })
  assert.equal(
    second.items.some((i) => first.items.some((j) => j.id === i.id)),
    false,
  )
  assert.equal(service.buildLibrary(input, { mastery: 'learned' }).total, 30)
  assert.equal(
    service.buildLibrary([word(1, { mastered: true }), word(2)], { mastery: 'unlearned' }).total,
    1,
  )
})
test(
  'real word library ownership, atomic mutation and duplicate registration',
  { skip: process.env.RUN_PDF_DB_TEST !== '1' },
  async () => {
    const db = require('../database/DAO'),
      words = require('../service/pdfWordService')
    const user = (await db.query('SELECT user_id FROM users ORDER BY user_id LIMIT 1')).rows[0]
      .user_id
    const notes = []
    try {
      for (let i = 0; i < 2; i++)
        notes.push(
          (
            await db.query(
              'INSERT INTO pdf_notes(user_id,title,file_key,file_size) VALUES($1,$2,$3,1) RETURNING note_id',
              [user, 'library-test', require('node:crypto').randomUUID()],
            )
          ).rows[0].note_id,
        )
      const input = {
        word: '試験-' + require('node:crypto').randomUUID(),
        reading: 'しけん',
        meaning: '시험',
        page: 1,
      }
      const a = await words.save(user, notes[0], null, input),
        b = await words.save(user, notes[1], null, input)
      await assert.rejects(words.save(user, notes[0], null, input), (e) => e.status === 409)
      const found = (await service.library(user, { q: input.word })).items[0]
      assert.equal(found.sources.length, 2)
      await assert.rejects(
        service.mutate(
          String(BigInt(user) + 1000000n),
          { ids: [a.word_id], mastered: true },
          false,
          true,
        ),
        (e) => e.status === 404,
      )
      await service.mutate(user, { ids: [a.word_id, b.word_id], mastered: true }, false, true)
      assert.equal((await service.library(user, { q: input.word, mastery: 'learned' })).total, 1)
      const other = await words.save(user, notes[1], null, {
        ...input,
        word: input.word + '-other',
      })
      await service.mutate(user, { ids: [other.word_id], mastered: true }, false, true)
      const reset = await service.resetMastery(user, { note_id: notes[0], mastery: 'learned' })
      assert.equal(reset.count, 1)
      assert.equal(
        (await words.list(user, notes[1])).find((row) => row.word_id === b.word_id).mastered,
        false,
      )
      assert.equal(
        (await words.list(user, notes[1])).find((row) => row.word_id === other.word_id).mastered,
        true,
      )
      assert.equal((await service.resetMastery(String(BigInt(user) + 1000000n), {})).count, 0)
      await words.remove(user, notes[1], other.word_id)
      await service.mutate(user, { ids: [a.word_id, b.word_id], mastered: false }, false, true)
      assert.equal((await service.library(user, { q: input.word, mastery: 'unlearned' })).total, 1)
      await assert.rejects(
        service.mutate(String(BigInt(user) + 1000000n), { ids: [a.word_id], ...input }),
        (e) => e.status === 404,
      )
      await assert.rejects(
        service.mutate(user, { ids: [a.word_id, '999999999999'], ...input }),
        (e) => e.status === 404,
      )
      assert.equal((await words.list(user, notes[0]))[0].meaning, '시험')
      await service.mutate(user, { ids: [a.word_id, b.word_id], ...input, meaning: '테스트' })
      assert.equal((await words.list(user, notes[1]))[0].meaning, '테스트')
      const conflict = await words.save(user, notes[0], null, { ...input, meaning: '중복' })
      await assert.rejects(
        service.mutate(user, { ids: [a.word_id, b.word_id], ...input, meaning: '중복' }),
        (e) => e.status === 409,
      )
      assert.equal(
        (await words.list(user, notes[1]))[0].meaning,
        '테스트',
        'failed batch must roll back every source',
      )
      await service.mutate(user, { ids: [a.word_id, b.word_id] }, true)
      assert.equal((await words.list(user, notes[1])).length, 0)
      assert.equal((await words.list(user, notes[0]))[0].word_id, conflict.word_id)
    } finally {
      if (notes.length)
        await db.query('DELETE FROM pdf_notes WHERE note_id=ANY($1::bigint[])', [notes])
      await db.pool.end()
    }
  },
)
