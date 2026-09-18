const express = require('express')
const memoService = require('../service/memoService')

const router = express.Router()

function requireLogin(req, res) {
  if (req.session.userId) return true
  res.status(401).json({ message: '로그인이 필요합니다.' })
  return false
}

function handleError(error, res, fallbackMessage) {
  if (error.message === 'INVALID_MEMO_DATE' || error.message === 'INVALID_MEMO_CONTENT') {
    return res.status(400).json({ message: '메모 내용을 확인해주세요.' })
  }
  console.error(error)
  return res.status(500).json({ message: fallbackMessage })
}

router.get('/:date', async (req, res) => {
  if (!requireLogin(req, res)) return
  try {
    res.json(await memoService.getMemo(req.session.userId, req.params.date))
  } catch (error) {
    handleError(error, res, '메모 조회 실패')
  }
})

router.put('/:date', async (req, res) => {
  if (!requireLogin(req, res)) return
  try {
    res.json(await memoService.saveMemo(
      req.session.userId,
      req.params.date,
      req.body.content
    ))
  } catch (error) {
    handleError(error, res, '메모 저장 실패')
  }
})

module.exports = router
