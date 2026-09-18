export function dateKey(date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-')
}
export function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const d = new Date(value + 'T00:00:00Z')
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value
}
export function mapEvent(event) {
  const start = event.start?.dateTime || event.start?.date || event.start
  const end = event.end?.dateTime || event.end?.date || event.end
  const allDay = event.allDay === true || Boolean(event.start?.date && !event.start?.dateTime)
  const calendarId = event.calendarId || 'primary'
  const time = value => new Intl.DateTimeFormat('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value))
  return {
    id: event.id, key: calendarId + ':' + event.id, calendarId,
    title: event.title || event.summary || 'タイトルなし', start, end, allDay,
    startTime: allDay ? '終日' : time(start), endTime: allDay ? '' : time(end),
    calendarName: event.calendarName || '', location: event.location || '',
    calendarColor: event.calendarColor || '#315cbb',
    calendarForegroundColor: event.calendarForegroundColor || '#ffffff',
    calendarOwned: event.calendarOwned !== false
  }
}
export function occursOn(event, key) {
  if (event.allDay) return event.start.slice(0,10) <= key && key < event.end.slice(0,10)
  const dayStart = new Date(key + 'T00:00:00')
  const dayEnd = new Date(dayStart)
  dayEnd.setDate(dayEnd.getDate() + 1)
  return new Date(event.start) < dayEnd && new Date(event.end || event.start) >= dayStart &&
    (new Date(event.end || event.start) > dayStart || new Date(event.start).getTime() === dayStart.getTime())
}
// FullCalendar treats startTime/endTime as recurrence settings, not display labels.
export function toCalendarInput(event) {
  return {
    id: event.key, title: event.title, start: event.start, end: event.end, allDay: event.allDay,
    backgroundColor: event.calendarColor || '#315cbb',
    borderColor: event.calendarColor || '#315cbb',
    textColor: event.calendarForegroundColor || '#ffffff'
  }
}
