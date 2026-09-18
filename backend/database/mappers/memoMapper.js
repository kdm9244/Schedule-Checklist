const dao = require('../DAO')
const memoSql = require('../sql/memoSql')

async function findByDate(userId, date) {
  const result = await dao.query(memoSql.FIND_BY_DATE, [userId, date])
  return result.rows[0] || null
}

async function upsert(userId, date, content) {
  const result = await dao.query(memoSql.UPSERT_MEMO, [userId, date, content])
  return result.rows[0]
}

module.exports = { findByDate, upsert }
