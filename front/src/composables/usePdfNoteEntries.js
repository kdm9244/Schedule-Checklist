import { reactive, ref, watch } from 'vue'
import { pdfNoteApi } from '../utils/pdfNoteApi'
import { pdfEntryBody, pdfEntryPayload } from '../utils/pdfNotes'
import { pdfNoteTitle } from '../utils/pdfNoteTitle'
export function usePdfNoteEntries({ noteId, owner, page, pageCount, draftScope }) {
  const entries = ref([]),
    selected = ref(null),
    busy = ref(false),
    error = ref(''),
    draftMessage = ref(''),
    dirty = ref(false)
  const blank = () => ({
      question: '',
      page: page.value || 1,
      body: '',
      body_format: 'plain',
      status: 'draft',
    }),
    form = reactive(blank())
  let restoring = false,
    baseline = ''
  const key = () =>
    `pdf-draft:${owner.value}:${noteId.value || draftScope?.value || 'new'}:${selected.value || 'new'}`
  function remember() {
    if (restoring || !owner.value) return
    dirty.value = JSON.stringify(form) !== baseline
    try {
      localStorage.setItem(key(), JSON.stringify(form))
      draftMessage.value = dirty.value ? '下書き保存済み' : ''
    } catch {
      draftMessage.value = '下書きを保存できません。閉じる前に保存してください。'
    }
  }
  watch(form, remember, { flush: 'sync' })
  function edit(entry) {
    restoring = true
    selected.value = entry?.entry_id || null
    Object.assign(
      form,
      entry
        ? {
            question: entry.question,
            page: entry.page,
            body: pdfEntryBody(entry),
            body_format: entry.body_format || 'plain',
            status: entry.status,
          }
        : blank(),
    )
    baseline = JSON.stringify(form)
    dirty.value = false
    draftMessage.value = ''
    try {
      const saved = JSON.parse(localStorage.getItem(key()) || 'null')
      if (saved) {
        Object.assign(form, {
          question: saved.question || '',
          page: saved.page || 1,
          body: pdfEntryBody(saved),
          body_format: saved.body_format || 'plain',
          status: saved.status || 'draft',
        })
        dirty.value = JSON.stringify(form) !== baseline
        draftMessage.value = dirty.value ? '下書きを復元しました' : ''
      }
    } catch {}
    restoring = false
    if (entry) page.value = entry.page
  }
  function initialize(list) {
    entries.value = list
    edit(null)
  }
  function choose(id) {
    edit(entries.value.find((e) => e.entry_id === id) || null)
  }
  function automaticTitle() {
    return pdfNoteTitle(form, entries.value)
  }
  async function save() {
    if (busy.value || !noteId.value) return false
    error.value = ''
    busy.value = true
    try {
      if (pageCount.value && form.page > pageCount.value)
        throw Error('PDFのページ範囲内で指定してください。')
      const payload = pdfEntryPayload({ ...form, question: automaticTitle() })
      const saved = await pdfNoteApi.saveEntry(noteId.value, selected.value, payload)
      try {
        localStorage.removeItem(key())
      } catch {}
      const index = entries.value.findIndex((e) => e.entry_id === saved.entry_id)
      if (index < 0) entries.value.push(saved)
      else entries.value[index] = saved
      restoring = true
      form.question = saved.question
      restoring = false
      selected.value = saved.entry_id
      baseline = JSON.stringify(form)
      dirty.value = false
      draftMessage.value = '保存しました'
      entries.value.sort((a, b) => a.page - b.page || Number(a.entry_id) - Number(b.entry_id))
      return true
    } catch (e) {
      error.value = e.response?.data?.message || e.message
      return false
    } finally {
      busy.value = false
    }
  }
  async function remove() {
    if (!selected.value || busy.value) return
    busy.value = true
    error.value = ''
    try {
      await pdfNoteApi.removeEntry(noteId.value, selected.value)
      try {
        localStorage.removeItem(key())
      } catch {}
      entries.value = entries.value.filter((e) => e.entry_id !== selected.value)
      edit(null)
    } catch (e) {
      error.value = e.response?.data?.message || e.message
    } finally {
      busy.value = false
    }
  }
  function transferDraft(id) {
    try {
      localStorage.setItem(`pdf-draft:${owner.value}:${id}:new`, JSON.stringify(form))
      localStorage.removeItem(key())
    } catch {}
    return { ...form }
  }
  function restoreTransferred(value) {
    restoring = true
    Object.assign(form, value)
    restoring = false
    remember()
  }
  return {
    entries,
    selected,
    busy,
    error,
    draftMessage,
    dirty,
    form,
    initialize,
    choose,
    save,
    remove,
    transferDraft,
    restoreTransferred,
  }
}
