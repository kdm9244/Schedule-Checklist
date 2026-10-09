export function pdfEntryBody(entry = {}) {
  if (typeof entry.body === 'string') return entry.body
  if (!entry.interpretation && !entry.review) return entry.solution || ''
  return [['問題の解釈', entry.interpretation], ['正解・解答と理由', entry.solution], ['迷った点・間違えた理由', entry.review]]
    .filter(([, text]) => text).map(([title, text]) => `${title}\n${text}`).join('\n\n')
}
export function pdfEntryPayload(form) {
  return { question: form.question, page: form.page, status: form.status || 'draft', interpretation: '', solution: form.body, review: '',body_format:form.body_format||'plain' }
}
