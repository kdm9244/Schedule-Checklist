const express = require('express')
const service = require('../service/pdfNoteService')
const files = require('../service/pdfNoteFiles')
const words = require('../service/pdfWordService')
const { identifier, entry } = require('../utils/pdfNoteValidation')
const router = express.Router()
router.use((req, res, next) =>
  req.session.userId ? next() : res.status(401).json({ message: 'ログインが必要です。' }),
)
const wrap = (action) => async (req, res) => {
  try {
    await action(req, res)
  } catch (error) {
    const setup = ['42P01', '42703'].includes(error.code)
    res.status(error.status || (setup ? 503 : 500)).json({
      message: error.status
        ? error.message
        : setup
          ? 'PDFノートの初期設定（006・007・008）が必要です。'
          : 'PDFノートを処理できませんでした。',
    })
  }
}
router.get(
  '/',
  wrap(async (req, res) => res.json(await service.list(req.session.userId))),
)
router.get(
  '/library',
  wrap(async (req, res) => res.json(await service.library(req.session.userId, req.query))),
)
router.post(
  '/',
  express.raw({ type: 'application/pdf', limit: '30mb' }),
  wrap(async (req, res) =>
    res.status(201).json(await service.create(req.session.userId, req.body, req.query)),
  ),
)
router.get(
  '/:id/words',
  wrap(async (req, res) =>
    res.json(await words.list(req.session.userId, identifier(req.params.id))),
  ),
)
router.post(
  '/:id/words',
  express.json({ limit: '16kb' }),
  wrap(async (req, res) =>
    res
      .status(201)
      .json(await words.save(req.session.userId, identifier(req.params.id), null, req.body)),
  ),
)
router.put(
  '/:id/words/:word',
  express.json({ limit: '16kb' }),
  wrap(async (req, res) =>
    res.json(
      await words.save(req.session.userId, identifier(req.params.id), req.params.word, req.body),
    ),
  ),
)
router.delete(
  '/:id/words/:word',
  wrap(async (req, res) =>
    res.json(await words.remove(req.session.userId, identifier(req.params.id), req.params.word)),
  ),
)
router.get(
  '/:id',
  wrap(async (req, res) => res.json(await service.get(req.session.userId, req.params.id))),
)
router.get(
  '/:id/file',
  wrap(async (req, res) => {
    const note = await service.owned(require('../database/DAO'), req.session.userId, req.params.id)
    res.set({
      'Content-Type': 'application/pdf',
      'Cache-Control': 'private, no-store',
      'Content-Disposition': 'inline; filename="study.pdf"',
      'X-Content-Type-Options': 'nosniff',
    })
    res.sendFile(files.filename(note.file_key), (error) => {
      if (error && !res.headersSent)
        res
          .status(404)
          .json({ message: 'PDFファイルがありません。バックアップを確認してください。' })
    })
  }),
)
router.patch(
  '/:id',
  wrap(async (req, res) =>
    res.json(await service.update(req.session.userId, req.params.id, req.body)),
  ),
)
router.post(
  '/:id/entries',
  wrap(async (req, res) =>
    res
      .status(201)
      .json(await service.saveEntry(req.session.userId, identifier(req.params.id), null, req.body)),
  ),
)
router.put(
  '/:id/entries/:entry',
  wrap(async (req, res) =>
    res.json(
      await service.saveEntry(
        req.session.userId,
        identifier(req.params.id),
        req.params.entry,
        req.body,
      ),
    ),
  ),
)
router.delete(
  '/:id/entries/:entry',
  wrap(async (req, res) =>
    res.json(
      await service.removeEntry(req.session.userId, identifier(req.params.id), req.params.entry),
    ),
  ),
)
router.delete(
  '/:id',
  wrap(async (req, res) => res.json(await service.remove(req.session.userId, req.params.id))),
)
router.use((error, req, res, next) => {
  if (error.type === 'entity.too.large')
    return res.status(413).json({ message: 'PDFは30MB以下にしてください。' })
  next(error)
})
module.exports = router
module.exports.validateEntry = entry
