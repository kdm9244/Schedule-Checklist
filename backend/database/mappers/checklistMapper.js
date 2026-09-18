const dao = require('../DAO')
const checklistSql = require('../sql/checklistSql')


async function findByDate(userId, date) {
  const result = await dao.query(
    checklistSql.FIND_BY_DATE,
    [userId, date]
  )

  return result.rows
}


async function findByEventId(userId, eventId) {
  const result = await dao.query(
    checklistSql.FIND_BY_EVENT_ID,
    [userId, eventId]
  )

  return result.rows
}


async function getNextSortOrder(userId, date) {
  const result = await dao.query(
    checklistSql.GET_NEXT_SORT_ORDER,
    [userId, date]
  )

  return result.rows[0].next_sort_order
}


async function insertChecklist(
  userId,
  eventId,
  title,
  targetDate,
  sortOrder
) {
  const result = await dao.query(
    checklistSql.INSERT_CHECKLIST,
    [
      userId,
      eventId,
      title,
      targetDate,
      sortOrder
    ]
  )

  return result.rows[0]
}


async function updateChecklist(
  userId,
  checklistId,
  title,
  targetDate,
  sortOrder
) {
  const result = await dao.query(
    checklistSql.UPDATE_CHECKLIST,
    [
      title,
      targetDate,
      sortOrder,
      checklistId,
      userId
    ]
  )

  return result.rows[0]
}


async function updateStatus(
  userId,
  checklistId,
  completed
) {
  const result = await dao.query(
    checklistSql.UPDATE_STATUS,
    [
      completed,
      checklistId,
      userId
    ]
  )

  return result.rows[0]
}


async function deleteChecklist(
  userId,
  checklistId
) {
  const result = await dao.query(
    checklistSql.DELETE_CHECKLIST,
    [
      checklistId,
      userId
    ]
  )

  return result.rows[0]
}


module.exports = {
  findByDate,
  findByEventId,
  getNextSortOrder,
  insertChecklist,
  updateChecklist,
  updateStatus,
  deleteChecklist
}