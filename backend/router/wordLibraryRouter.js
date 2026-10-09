const express = require('express')
const service = require('../service/wordLibraryService')
const router = express.Router()
router.use((req, res, next) =>
  req.session?.userId ? next() : res.status(401).json({ message: 'ログインが必要です。' }),
)
const wrap = (action) => async (req, res) => {
  try {
    res.json(await action(req))
  } catch (error) {
    res.status(error.status || (error.code === '42P01' ? 503 : 500)).json({
      message: error.status
        ? error.message
        : error.code === '42P01'
          ? '単語の初期設定（008）が必要です。'
          : '単語を処理できませんでした。',
    })
  }
}
router.get(
  '/',
  wrap((req) => service.library(req.session.userId, req.query)),
)
router.patch(
  '/mastery/reset',
  wrap((req) => service.resetMastery(req.session.userId, req.body)),
)
router.patch(
  '/mastery',
  wrap((req) => service.mutate(req.session.userId, req.body, false, true)),
)
router.patch(
  '/',
  wrap((req) => service.mutate(req.session.userId, req.body)),
)
router.delete(
  '/',
  wrap((req) => service.mutate(req.session.userId, req.body, true)),
)
module.exports = router
