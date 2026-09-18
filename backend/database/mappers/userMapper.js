const dao = require('../DAO')
const userSql = require('../sql/userSql')

async function findByGoogleId(googleId) {
  const result = await dao.query(
    userSql.FIND_BY_GOOGLE_ID,
    [googleId]
  )

  return result.rows[0]
}

async function insertUser(googleUser) {
  const result = await dao.query(
    userSql.INSERT_USER,
    [
      googleUser.id,
      googleUser.email,
      googleUser.name,
      googleUser.picture
    ]
  )

  return result.rows[0]
}

async function findById(userId) {
  const result = await dao.query(
    userSql.FIND_BY_ID,
    [userId]
  )

  return result.rows[0]
}

module.exports = {
  findByGoogleId,
  insertUser,
  findById
}