const { test } = require('node:test')
const assert = require('node:assert/strict')
const service = require('../service/pdfWordService')
test('word validation requires word and meaning and accepts omitted readings', () => {
  assert.deepEqual(
    service.validate({ word: ' サービス ', reading: '', meaning: '서비스', page: 1 }),
    { word: 'サービス', reading: '', meaning: '서비스', page: 1 },
  )
  for (const patch of [{ word: '' }, { meaning: ' ' }, { reading: 'x'.repeat(201) }, { page: 0 }])
    assert.throws(
      () =>
        service.validate({ word: '販売', reading: 'はんばい', meaning: '판매', page: 1, ...patch }),
      (e) => e.status === 400,
    )
})
test(
  'word persistence, ownership and cascade deletion',
  { skip: process.env.RUN_PDF_DB_TEST !== '1' },
  async () => {
    const db = require('../database/DAO')
    let id
    try {
      const user = (await db.query('SELECT user_id FROM users ORDER BY user_id LIMIT 1')).rows[0]
        .user_id
      id = (
        await db.query(
          'INSERT INTO pdf_notes(user_id,title,file_key,file_size) VALUES($1,$2,$3,1) RETURNING note_id',
          [user, 'word-test', require('node:crypto').randomUUID()],
        )
      ).rows[0].note_id
      const value = { word: '販売', reading: 'はんばい', meaning: '판매', page: 2 }
      const saved = await service.save(user, id, null, value)
      assert.equal((await service.list(user, id))[0].meaning, '판매')
      const other = String(BigInt(user) + 1000000n)
      await assert.rejects(service.list(other, id), (e) => e.status === 404)
      await assert.rejects(service.save(other, id, saved.word_id, value), (e) => e.status === 404)
      await assert.rejects(service.remove(other, id, saved.word_id), (e) => e.status === 404)
      assert.equal(
        (await service.save(user, id, saved.word_id, { ...value, meaning: '판매하다' })).meaning,
        '판매하다',
      )
      await service.remove(user, id, saved.word_id)
      assert.equal((await service.list(user, id)).length, 0)
      await service.save(user, id, null, value)
      await db.query('DELETE FROM pdf_notes WHERE note_id=$1', [id])
      assert.equal(
        (await db.query('SELECT * FROM pdf_note_words WHERE note_id=$1', [id])).rowCount,
        0,
      )
    } finally {
      if (id) await db.query('DELETE FROM pdf_notes WHERE note_id=$1', [id])
      await db.pool.end()
    }
  },
)
