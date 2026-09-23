const dao = require('../DAO')
const checklistSql = require('../sql/checklistSql')


async function findByDate(userId, date) {
  const result = await dao.query(
    checklistSql.FIND_BY_DATE,
    [userId, date]
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

async function updateTitle(userId, checklistId, title) {
  const result = await dao.query(checklistSql.UPDATE_TITLE, [title, checklistId, userId])
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
  getNextSortOrder,
  insertChecklist,
  updateStatus,
  updateTitle,
  deleteChecklist
}
