import axios from 'axios'
import { API_ORIGIN } from './http'
const client = axios.create({ baseURL: API_ORIGIN + '/api/pdf-notes', withCredentials: true })
export const pdfNoteApi = {
  words: (id) => client.get('/' + id + '/words').then((r) => r.data),
  saveWord: (id, word, input) =>
    (word
      ? client.put('/' + id + '/words/' + word, input)
      : client.post('/' + id + '/words', input)
    ).then((r) => r.data),
  removeWord: (id, word) => client.delete('/' + id + '/words/' + word).then((r) => r.data),
  library: (params, signal) => client.get('/library', { params, signal }).then((r) => r.data),
  get: (id) => client.get('/' + id).then((r) => r.data),
  upload: (file, metadata) =>
    client
      .post('/', file, { headers: { 'Content-Type': 'application/pdf' }, params: metadata })
      .then((r) => r.data),
  update: (id, input) => client.patch('/' + id, input).then((r) => r.data),
  remove: (id) => client.delete('/' + id).then((r) => r.data),
  saveEntry: (id, entry, input) =>
    (entry
      ? client.put('/' + id + '/entries/' + entry, input)
      : client.post('/' + id + '/entries', input)
    ).then((r) => r.data),
  removeEntry: (id, entry) => client.delete('/' + id + '/entries/' + entry).then((r) => r.data),
  fileUrl: (id) => API_ORIGIN + '/api/pdf-notes/' + id + '/file',
}
export async function validatePdfFile(file) {
  if (
    !file ||
    !file.size ||
    file.size > 30 * 1048576 ||
    !file.name.toLowerCase().endsWith('.pdf') ||
    (await file.slice(0, 5).text()) !== '%PDF-'
  )
    throw Error('30MB以下のPDFファイルを選択してください。')
  return file
}
export function pdfNoteBackLink(note) {
  return note?.task_id
    ? '/learning/tasks/' + note.task_id
    : note?.milestone_id
      ? '/learning/milestones/' + note.milestone_id
      : note?.roadmap_id
        ? '/learning/roadmaps/' + note.roadmap_id
        : '/learning/pdf-notes'
}
export function clearPdfDrafts(owner, id) {
  try {
    for (const key of Object.keys(localStorage))
      if (key.startsWith('pdf-draft:' + owner + ':' + id + ':')) localStorage.removeItem(key)
  } catch {}
}
