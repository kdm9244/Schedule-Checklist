const checklistMapper =
  require('../database/mappers/checklistMapper')
const { ensureSchema } = require('./checklistSchemaService')


async function getChecklistsByDate(
  userId,
  date
) {
  await ensureSchema()
  return await checklistMapper.findByDate(
    userId,
    date
  )
}


async function createChecklist(
  userId,
  data
) {
  await ensureSchema()
  const {
    eventId = null,
    title,
    targetDate
  } = data

  if (typeof title !== 'string' || !title.trim() || title.length > 200 ||
      !require('../utils/validation').validDate(targetDate) ||
      (eventId !== null && (typeof eventId !== 'string' || eventId.length > 1000))) {
    throw new Error('INVALID_CHECKLIST')
  }

  const sortOrder =
    await checklistMapper.getNextSortOrder(
      userId,
      targetDate
    )

  return await checklistMapper.insertChecklist(
    userId,
    eventId,
    title.trim(),
    targetDate,
    sortOrder
  )
}


async function updateChecklistStatus(
  userId,
  checklistId,
  completed
) {
  await ensureSchema()
  return await checklistMapper.updateStatus(
    userId,
    checklistId,
    completed
  )
}

async function updateChecklistTitle(userId, checklistId, title) {
  await ensureSchema()
  if (!/^\d+$/.test(String(checklistId)) || typeof title !== 'string' || !title.trim() || title.trim().length > 200) {
    throw new Error('INVALID_CHECKLIST')
  }
  return await checklistMapper.updateTitle(userId, checklistId, title.trim())
}


async function deleteChecklist(
  userId,
  checklistId
) {
  await ensureSchema()
  return await checklistMapper.deleteChecklist(
    userId,
    checklistId
  )
}


module.exports = {
  getChecklistsByDate,
  createChecklist,
  updateChecklistStatus,
  updateChecklistTitle,
  deleteChecklist
}
