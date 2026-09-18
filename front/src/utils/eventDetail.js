import { dateKey } from './calendar.js'

// Never render incoming Google HTML. Produce text and explicitly allowlisted links.
export function readableDescription(html) {
  // Template content is inert: embedded images/iframes cannot initiate resource loads.
  const template = document.createElement('template')
  template.innerHTML = String(html || '')
  const links = []
  const walk = node => {
    if (node.nodeType === 3) return node.textContent
    if (node.nodeType === 11) return [...node.childNodes].map(walk).join('')
    if (node.nodeType !== 1) return ''
    if (['SCRIPT','STYLE','IFRAME','OBJECT','EMBED','SVG','MATH','TEMPLATE'].includes(node.tagName)) return ''
    if (node.tagName === 'BR') return '\n'
    const text = [...node.childNodes].map(walk).join('')
    if (node.tagName === 'A') {
      try {
        const url = new URL(node.getAttribute('href'))
        if (['https:','http:','mailto:'].includes(url.protocol)) links.push({ text:text.trim() || url.href, url:url.href })
      } catch { /* Ignore relative and invalid links. */ }
    }
    return text + (['P','DIV','LI','H1','H2','H3','TR','UL','OL','BLOCKQUOTE'].includes(node.tagName) ? '\n' : '')
  }
  return { text:walk(template.content).replace(/\n{3,}/g,'\n\n').trim(), links:[...new Map(links.map(link => [link.url,link])).values()] }
}
function localTime(value) {
  const d = new Date(value)
  return dateKey(d) + 'T' + String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0')
}
export function editDraft(event, description) {
  const allDay = Boolean(event.start.date)
  const inclusiveEnd = allDay ? new Date(event.end.date + 'T00:00:00') : null
  if (inclusiveEnd) inclusiveEnd.setDate(inclusiveEnd.getDate()-1)
  return {
    summary:event.summary || '', location:event.location || '', description, allDay,
    start:allDay ? event.start.date : localTime(event.start.dateTime),
    end:allDay ? dateKey(inclusiveEnd) : localTime(event.end.dateTime)
  }
}
export function editPayload(draft, event, originalText) {
  let start, end
  if (draft.allDay) {
    if (!draft.start || !draft.end || draft.end < draft.start) throw new Error('終了日を確認してください。')
    const exclusive = new Date(draft.end + 'T00:00:00'); exclusive.setDate(exclusive.getDate()+1)
    start = {date:draft.start}; end = {date:dateKey(exclusive)}
  } else {
    const s = new Date(draft.start), e = new Date(draft.end)
    if (!Number.isFinite(s.getTime()) || !Number.isFinite(e.getTime()) || s >= e) throw new Error('終了日時は開始日時より後にしてください。')
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
    start = {dateTime:s.toISOString(),timeZone:zone}; end = {dateTime:e.toISOString(),timeZone:zone}
  }
  const original = editDraft(event,originalText)
  // Keep seconds, offsets and named timezones when only other fields are edited.
  if (draft.allDay === original.allDay) {
    if (draft.start === original.start) start = event.start
    if (draft.end === original.end) end = event.end
  }
  return {summary:draft.summary,location:draft.location,
    // Editing the title must not silently erase existing description formatting.
    description:draft.description === originalText ? event.description || '' : draft.description,start,end}
}
