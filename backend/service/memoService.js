const memoMapper = require('../database/mappers/memoMapper')

const MAX_CONTENT_LENGTH = 500

function validateDate(date) {
  if (!require('../utils/validation').validDate(date)) throw new Error('INVALID_MEMO_DATE')
}

async function getMemo(userId, date) {
  validateDate(date)
  const memo = await memoMapper.findByDate(userId, date)
  return memo || { memo_id: null, memo_date: date, content: '' }
}

async function saveMemo(userId, date, content) {
  validateDate(date)
  if (typeof content !== 'string' || content.length > MAX_CONTENT_LENGTH) {
    throw new Error('INVALID_MEMO_CONTENT')
  }
  return memoMapper.upsert(userId, date, content)
}

module.exports = { getMemo, saveMemo }
