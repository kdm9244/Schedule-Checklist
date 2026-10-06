const express = require('express')
const service = require('../service/learningService')
const router = express.Router()
router.use((req,res,next)=>req.session.userId ? next() : res.status(401).json({message:'ログインが必要です。'}))
function handle(action) {
  return async (req,res) => {
    try { res.json(await action(req)) } catch(error) {
      const missing = ['42P01','42883'].includes(error.code)
      const status = missing ? 503 : error.status || (['23503','23514','22003','22P02'].includes(error.code) ? 400 : 500)
      console.error('Learning request failed:',error.code || status)
      res.status(status).json({
        ...(missing ? {code:'LEARNING_SCHEMA_NOT_READY'} : {}),
        message:missing ? 'ログインは完了しています。学習機能の初期設定がまだ完了していません。' : error.status ? error.message : status === 400 ? '関連データを確認してください。' : '保存・読み込みに失敗しました。再試行してください。'
      })
    }
  }
}
router.get('/',handle(req=>service.snapshot(req.session.userId)))
router.post('/milestones/reorder',handle(req=>service.reorder(req.session.userId,req.body.roadmap_id,req.body.ids)))
router.post('/:kind',handle(req=>service.save(req.params.kind,req.session.userId,null,req.body || {})))
router.patch('/:kind/:id',handle(req=>service.save(req.params.kind,req.session.userId,req.params.id,req.body || {})))
router.delete('/:kind/:id',handle(req=>service.remove(req.params.kind,req.session.userId,req.params.id)))
module.exports = router
