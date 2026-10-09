export function pdfNoteTitle(form, entries) {
  if (form.question?.trim()) return form.question.trim()
  const base = `${form.page}ページ ノート`
  const samePage = entries.filter((entry) => entry.page === form.page)
  const titles = new Set(samePage.map((entry) => entry.question))
  let number = samePage.length + 1
  let title = number === 1 ? base : `${base} ${number}`
  while (titles.has(title)) title = `${base} ${++number}`
  return title
}
