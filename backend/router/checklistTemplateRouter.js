const express = require('express')
const service = require('../service/checklistTemplateService')
const router = express.Router()

router.use((req,res,next) => req.session.userId ? next() : res.status(401).json({message:'ログインが必要です。'}))
router.get('/', async (req,res) => { try { res.json(await service.list(req.session.userId)) } catch(error) { console.error(error);res.status(500).json({message:'設定を読み込めませんでした。'}) } })
router.post('/', async (req,res) => { try { res.status(201).json(await service.create(req.session.userId,req.body||{})) } catch(error) { res.status(error.message==='INVALID_TEMPLATE'?400:500).json({message:error.message==='INVALID_TEMPLATE'?'入力内容を確認してください。':'設定を保存できませんでした。'}) } })
router.patch('/:id', async (req,res) => { try { const row=await service.update(req.session.userId,req.params.id,req.body||{});row?res.json(row):res.status(404).json({message:'設定が見つかりません。'}) } catch(error) { res.status(error.message==='INVALID_TEMPLATE'?400:500).json({message:error.message==='INVALID_TEMPLATE'?'入力内容を確認してください。':'設定を保存できませんでした。'}) } })
router.delete('/:id', async (req,res) => { try { const row=await service.remove(req.session.userId,req.params.id);row?res.json(row):res.status(404).json({message:'設定が見つかりません。'}) } catch { res.status(500).json({message:'設定を削除できませんでした。'}) } })

module.exports = router
