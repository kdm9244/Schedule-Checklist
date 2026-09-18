const checklistMapper =
  require('../database/mappers/checklistMapper')


async function getChecklistsByDate(
  userId,
  date
) {
  return await checklistMapper.findByDate(
    userId,
    date
  )
}


async function getChecklistsByEvent(
  userId,
  eventId
) {
  return await checklistMapper.findByEventId(
    userId,
    eventId
  )
}


async function createChecklist(
  userId,
  data
) {
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


async function updateChecklist(
  userId,
  checklistId,
  data
) {
  return await checklistMapper.updateChecklist(
    userId,
    checklistId,
    data.title,
    data.targetDate,
    data.sortOrder
  )
}


async function updateChecklistStatus(
  userId,
  checklistId,
  completed
) {
  return await checklistMapper.updateStatus(
    userId,
    checklistId,
    completed
  )
}


async function deleteChecklist(
  userId,
  checklistId
) {
  return await checklistMapper.deleteChecklist(
    userId,
    checklistId
  )
}


module.exports = {
  getChecklistsByDate,
  getChecklistsByEvent,
  createChecklist,
  updateChecklist,
  updateChecklistStatus,
  deleteChecklist
}
