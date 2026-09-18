const express = require('express')
const router = express.Router()

const userService = require('../service/userService')

router.get('/me', async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({
        message: '로그인이 필요합니다.'
      })
    }

    const user = await userService.getUserById(
      req.session.userId
    )

    if (!user) {
      return res.status(404).json({
        message: '사용자를 찾을 수 없습니다.'
      })
    }

    res.json({
      userId: user.user_id,
      email: user.email,
      userName: user.user_name,
      profileImage: user.profile_image
    })
  } catch (error) {
    console.error(error)

    res.status(500).json({
      message: '사용자 정보 조회 실패'
    })
  }
})

module.exports = router