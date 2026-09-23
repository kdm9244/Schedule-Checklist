const express = require('express')
const router = express.Router()

const checklistService =
  require('../service/checklistService')


router.get('/', async (req, res) => {
  try {

    if (!req.session.userId) {
      return res.status(401).json({
        message: '로그인이 필요합니다.'
      })
    }

    const date = req.query.date

    if (!date) {
      return res.status(400).json({
        message: 'date가 필요합니다.'
      })
    }

    await require('../service/checklistTemplateService').materializeForDate(req.session.userId, date)

    const checklists =
      await checklistService.getChecklistsByDate(
        req.session.userId,
        date
      )

    res.json(checklists)

  } catch (error) {

    console.error(error)

    res.status(500).json({
      message: '체크리스트 조회 실패'
    })

  }
})

router.post('/', async (req, res) => {
  try {

    if (!req.session.userId) {
      return res.status(401).json({
        message: '로그인이 필요합니다.'
      })
    }

    const checklist =
      await checklistService.createChecklist(
        req.session.userId,
        req.body
      )

    res.status(201).json(checklist)

  } catch (error) {

    console.error(error)

    if (error.message === 'INVALID_CHECKLIST') {
      return res.status(400).json({
        message: '체크리스트 내용을 확인해주세요.'
      })
    }

    res.status(500).json({
      message: '체크리스트 등록 실패'
    })

  }
})


router.patch('/:id/status', async (req, res) => {
  try {

    if (!req.session.userId) {
      return res.status(401).json({
        message: '로그인이 필요합니다.'
      })
    }

    const checklist =
      await checklistService.updateChecklistStatus(
        req.session.userId,
        req.params.id,
        req.body.completed
      )

    if (!checklist) {
      return res.status(404).json({
        message: '체크리스트를 찾을 수 없습니다.'
      })
    }

    res.json(checklist)

  } catch (error) {

    console.error(error)

    res.status(500).json({
      message: '체크리스트 상태 변경 실패'
    })

  }
})

router.patch('/:id', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: 'ログインが必要です。' })
  try {
    const checklist = await checklistService.updateChecklistTitle(req.session.userId, req.params.id, req.body?.title)
    if (!checklist) return res.status(404).json({ message: 'チェックリストが見つかりません。' })
    res.json(checklist)
  } catch (error) {
    if (error.message === 'INVALID_CHECKLIST') return res.status(400).json({ message: 'チェックリストの内容を確認してください。' })
    console.error('Checklist title update failed:', error.code || error.message)
    res.status(500).json({ message: 'チェックリストを更新できませんでした。' })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({
        message: '로그인이 필요합니다.'
      })
    }

    await require('../service/checklistTemplateService').skipInstanceForChecklist(req.session.userId, req.params.id)

    const checklist =
      await checklistService.deleteChecklist(
        req.session.userId,
        req.params.id
      )

    if (!checklist) {
      return res.status(404).json({
        message: '체크리스트를 찾을 수 없습니다.'
      })
    }

    res.json(checklist)
  } catch (error) {
    console.error(error)

    res.status(500).json({
      message: '체크리스트 삭제 실패'
    })
  }
})


router.post('/event-batch', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: 'ログインが必要です。' })
  const keys = req.body?.keys
  if (!Array.isArray(keys) || keys.length > 1000 || keys.some(key => typeof key !== 'string' || key.length > 1000)) {
    return res.status(400).json({ message: 'Invalid event keys' })
  }
  try {
    await require('../service/checklistSchemaService').ensureSchema()
    const result = await require('../database/DAO').query(
      'SELECT * FROM checklists WHERE user_id=$1 AND event_id=ANY($2::varchar[]) ORDER BY sort_order,checklist_id',
      [req.session.userId, keys]
    )
    res.json(result.rows)
  } catch (error) {
    console.error('Event checklist batch read failed:', error.code || error.message)
    res.status(500).json({ message: 'チェックリストを読み込めませんでした。' })
  }
})

router.put('/reorder', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: 'ログインが必要です。' })
  const { ids, date, eventId = null } = req.body || {}
  if (!require('../utils/validation').validDate(date) || !Array.isArray(ids) || ids.length > 500 ||
      ids.some(id => !/^\d+$/.test(String(id))) || new Set(ids.map(String)).size !== ids.length ||
      (eventId !== null && typeof eventId !== 'string')) {
    return res.status(400).json({ message: 'Invalid order' })
  }
  const client = await require('../database/DAO').pool.connect()
  try {
    await client.query('BEGIN')
    const rows = await client.query(
      `SELECT c.checklist_id FROM checklists c
       LEFT JOIN checklist_templates t ON t.user_id=c.user_id AND t.template_id=c.template_id
       WHERE c.user_id=$1 AND ($3::varchar IS NOT NULL OR c.target_date=$2) AND c.event_id IS NOT DISTINCT FROM $3
         AND ($3::varchar IS NOT NULL OR c.template_id IS NULL OR c.target_date<CURRENT_DATE OR t.is_active=TRUE)
       ORDER BY c.checklist_id FOR UPDATE OF c`,
      [req.session.userId, date, eventId]
    )
    if (rows.rows.length !== ids.length || rows.rows.some(row => !ids.map(String).includes(String(row.checklist_id)))) {
      await client.query('ROLLBACK')
      return res.status(409).json({ message: '項目が変更されています。再読み込みしてください。' })
    }
    for (let i = 0; i < ids.length; i++) {
      await client.query('UPDATE checklists SET sort_order=$1, updated_at=CURRENT_TIMESTAMP WHERE user_id=$2 AND checklist_id=$3',
        [i + 1, req.session.userId, ids[i]])
    }
    await client.query('COMMIT')
    res.json({ success: true })
  } catch {
    await client.query('ROLLBACK')
    res.status(500).json({ message: '順序を保存できませんでした。' })
  } finally { client.release() }
})

module.exports = router
