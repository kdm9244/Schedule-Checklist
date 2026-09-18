const { google } = require('googleapis')
const userMapper = require('../database/mappers/userMapper')

const createOAuthClient = () => new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
)

function getGoogleLoginUrl(state) {
  const oauth2Client = createOAuthClient()
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    state,
    prompt: 'consent',
    scope: [
      'openid',
      'email',
      'profile',
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/calendar.calendarlist.readonly'
    ]
  })
}

async function getGoogleUser(code) {
  const oauth2Client = createOAuthClient()

  const { tokens } = await oauth2Client.getToken(code)

  oauth2Client.setCredentials(tokens)

  const oauth2 = google.oauth2({
    version: 'v2',
    auth: oauth2Client
  })

  const { data } = await oauth2.userinfo.get()

  return {
    googleUser: data,
    tokens
  }
}

async function loginOrCreateUser(googleUser) {
  let user = await userMapper.findByGoogleId(googleUser.id)

  if (!user) {
    user = await userMapper.insertUser(googleUser)
  }

  return user
}

module.exports = {
  getGoogleLoginUrl,
  getGoogleUser,
  loginOrCreateUser
}
