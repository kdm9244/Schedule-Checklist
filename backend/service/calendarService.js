const { google } = require('googleapis');
const preferences = require('./calendarPreferenceService')

const FALLBACK_COLORS = ['#315cbb','#16856b','#8b5eb5','#d06b42','#347f9d','#b35b72','#71833c','#6758a8']
function fallbackColor(id = '') {
    let hash = 0
    for (const char of id) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0
    return FALLBACK_COLORS[Math.abs(hash) % FALLBACK_COLORS.length]
}

function createCalendar(tokens) {
    const auth = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI
    )
    auth.setCredentials(tokens)
    auth.on('tokens', fresh => Object.assign(tokens, fresh))
    return google.calendar({ version: 'v3', auth })
}

async function getEvents(userId, tokens, options = {}) {
    const calendar = createCalendar(tokens)
    const { start, end } = getDateRange(options)

    const calendars = (await calendarSources(userId, calendar)).filter(item => item.visible)
    const calendarResults = await Promise.all(
        calendars.map(async calendarItem => {
            const calendarEvents = await listEvents(
                calendar,
                calendarItem.id,
                start,
                end
            )

            return calendarEvents.map(event => ({
                ...event,
                calendarId: calendarItem.id,
                calendarName: calendarItem.summary || calendarItem.id,
                calendarColor: calendarItem.color,
                calendarForegroundColor: calendarItem.foregroundColor,
                calendarOwned: calendarItem.owned
            }))
        })
    )
    const events = calendarResults.flat()

    return events.sort((first, second) => {
        const firstStart = first.start?.dateTime || first.start?.date || ''
        const secondStart = second.start?.dateTime || second.start?.date || ''
        return firstStart.localeCompare(secondStart)
    })
}

async function getCalendarSources(userId, tokens) {
    return calendarSources(userId, createCalendar(tokens))
}

async function calendarSources(userId, calendar) {
    const [items, visibility] = await Promise.all([listCalendars(calendar),preferences.visibilityMap(userId)])
    return items.map(item => ({
        id:item.id,
        summary:item.summaryOverride || item.summary || item.id,
        color:item.backgroundColor || fallbackColor(item.id),
        foregroundColor:item.foregroundColor || '#ffffff',
        primary:item.primary === true,
        owned:item.primary === true || item.accessRole === 'owner',
        accessRole:item.accessRole || 'reader',
        visible:visibility.has(item.id) ? visibility.get(item.id) : true
    })).sort((a,b) => Number(b.primary)-Number(a.primary) || a.summary.localeCompare(b.summary,'ja'))
}

function parseDate(date) {
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        throw require('../utils/validation').badRequest('날짜 형식은 YYYY-MM-DD여야 합니다.')
    }

    const targetDate = date
        ? new Date(`${date}T00:00:00`)
        : new Date()

    if (Number.isNaN(targetDate.getTime()) || (date && require('../utils/validation').validDate(date) === false)) {
        throw require('../utils/validation').badRequest('유효하지 않은 날짜입니다.')
    }

    if (!date) {
        targetDate.setHours(0, 0, 0, 0)
    }

    return targetDate
}

async function listCalendars(calendar) {
    const calendars = []
    let pageToken

    do {
        const response = await calendar.calendarList.list({
            minAccessRole: 'reader',
            showHidden: true,
            colorRgbFormat: true,
            pageToken
        })

        calendars.push(...(response.data.items || []))
        pageToken = response.data.nextPageToken
    } while (pageToken)

    return calendars
}

async function listEvents(calendar, calendarId, start, end) {
    const events = []
    let pageToken

    do {
        const response = await calendar.events.list({
            calendarId,
            timeMin: start.toISOString(),
            timeMax: end.toISOString(),
            singleEvents: true,
            orderBy: 'startTime',
            pageToken
        })

        events.push(...(response.data.items || []))
        pageToken = response.data.nextPageToken
    } while (pageToken)

    return events
}

module.exports = {
    getEvents, getCalendarSources, createCalendar, getDateRange, fallbackColor

}

function getDateRange(options) {
    if (typeof options === 'string') {
        options = { date: options }
    }

    if (options.startDate || options.endDate) {
        if (!options.startDate || !options.endDate) {
            throw require('../utils/validation').badRequest('startDate와 endDate가 모두 필요합니다.')
        }

        const start = parseDate(options.startDate)
        const end = parseDate(options.endDate)
        end.setDate(end.getDate() + 1)

        if (start >= end || end - start > 93 * 86400000) {
            throw require('../utils/validation').badRequest('조회 날짜 범위를 확인해주세요.')
        }

        return { start, end }
    }

    const start = parseDate(options.date)
    const end = new Date(start)
    end.setDate(end.getDate() + 1)
    return { start, end }
}
