const express = require('express')
const router = express.Router()

const calendarService =
  require('../service/calendarService')

router.get('/events', async (req, res) => {
  try {

    if (!req.session.userId) {
      return res.status(401).json({
        message: '로그인이 필요합니다.'
      })
    }

    if (!req.session.googleTokens) {
      return res.status(401).json({
        message: 'Google 인증 정보가 없습니다.'
      })
    }

    const events =
      await calendarService.getEvents(
        req.session.userId,
        req.session.googleTokens,
        {
          date: req.query.date,
          startDate: req.query.startDate,
          endDate: req.query.endDate
        }
      )

    res.json(events)

  } catch (error) {
    console.error('Calendar read failed:', error.code || error.status || 'UNKNOWN')

    res.status(error.status || 502).json({
      message: 'Google Calendar 조회 실패'
    })
  }
})

router.post('/events', async (req, res) => {
  if (!req.session.userId || !req.session.googleTokens) {
    return res.status(401).json({ message: 'ログインし直してください。' })
  }
  try {
    const result = await require('../service/eventCreateService').createEvent(
      req.session.userId, req.session.googleTokens, req.body
    )
    res.status(201).json(result)
  } catch (error) {
    console.error('Event creation failed:', error.code || error.status || 'UNKNOWN')
    res.status(error.status || 502).json({ message: error.status ? error.message :
      '登録を完了できませんでした。同じ内容で再試行してください。重複登録はされません。' })
  }
})

router.get('/calendars', async (req,res) => {
  if (!req.session.userId || !req.session.googleTokens) return res.status(401).json({message:'ログインし直してください。'})
  try { res.json(await calendarService.getCalendarSources(req.session.userId,req.session.googleTokens)) }
  catch(error) { console.error('Calendar list failed:',error.code||error.status||'UNKNOWN');res.status(502).json({message:'カレンダー一覧を取得できませんでした。'}) }
})

router.put('/calendars/visibility', async (req,res) => {
  if (!req.session.userId || !req.session.googleTokens) return res.status(401).json({message:'ログインし直してください。'})
  try { res.json(await require('../service/calendarPreferenceService').setVisibility(req.session.userId,req.body||{})) }
  catch(error) {
    const invalid=error.message==='INVALID_CALENDAR_PREFERENCE'
    res.status(invalid?400:500).json({message:invalid?'入力内容を確認してください。':'表示設定を保存できませんでした。'})
  }
})

const management = require('../service/eventManageService')
for (const [method, action] of [['get','getEvent'],['patch','updateEvent'],['delete','deleteEvent']]) {
  router[method]('/event', async (req,res) => {
    if (!req.session.userId || !req.session.googleTokens) return res.status(401).json({message:'ログインし直してください。'})
    try {
      res.json(await management[action](req.session.userId,req.session.googleTokens,
        method === 'get' ? req.query : req.body))
    } catch (error) {
      const code = Number(error.status || error.response?.status || error.code)
      const status = [400,401,403,404,409,410,412].includes(code) ? code : 502
      const messages = {
        400:'入力内容を確認してください。',401:'Google にログインし直してください。',
        403:'この予定を変更する権限がありません。',404:'予定が見つからないか、アクセスできません。',
        409:'予定が変更されています。最新の内容を確認してください。',
        410:'この予定は削除されています。',412:'予定が他の画面で変更されています。入力を控えて、最新の内容を確認してください。',
        502:'処理を完了できませんでした。Google 側は反映済みの可能性があります。同じ内容で再試行してください。'
      }
      console.error('Event management failed:',action,status)
      res.status(status).json({message:error.status ? error.message : messages[status]})
    }
  })
}
module.exports = router
