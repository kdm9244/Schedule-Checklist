const express = require('express')
const router = express.Router()

const authService = require('../service/authService')

router.get('/google', (req, res) => {
  req.session.oauthState = require('node:crypto').randomBytes(32).toString('hex')
  const url = authService.getGoogleLoginUrl(req.session.oauthState)
  req.session.save(error => error ? res.sendStatus(500) : res.redirect(url))
})

router.get('/google/callback', async (req, res) => {
  try {
    const code = req.query.code
    if (typeof code !== 'string' || !req.session.oauthState || req.query.state !== req.session.oauthState) {
      return res.status(400).send('認証をやり直してください。')
    }
    delete req.session.oauthState

    const { googleUser, tokens } =
      await authService.getGoogleUser(code)

    const user =
      await authService.loginOrCreateUser(googleUser)

    await new Promise((resolve, reject) => req.session.regenerate(error => error ? reject(error) : resolve()))
    req.session.userId = user.user_id
    req.session.googleTokens = tokens

    req.session.save(error => error ? res.sendStatus(500) : res.redirect(process.env.FRONTEND_URL || 'http://localhost:5173/'))
  } catch (error) {
    console.error('Google login failed:', error.code || 'UNKNOWN')
    res.redirect((process.env.FRONTEND_URL || 'http://localhost:5173') + '/login')
  }
})

router.post('/logout', (req, res) => {
  req.session.destroy((error) => {
    if (error) {
      console.error(error)

      return res.status(500).json({
        message: '로그아웃에 실패했습니다.'
      })
    }

    res.clearCookie('connect.sid')

    return res.json({
      message: 'Logout successful'
    })
  })
})

module.exports = router
