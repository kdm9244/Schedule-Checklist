<template>
  <div class="pdf-workspace" :class="{ 'workspace-expanded': expanded, 'pdf-only': pdfOnly }">
    <header class="workspace-header">
      <RouterLink :to="backLink" class="workspace-back" aria-label="学習ノートに戻る">‹</RouterLink>
      <div class="workspace-heading">
        <h1>{{ note?.title || 'PDFノートを作成' }}</h1>
        <span>{{ contextLabel }}</span>
      </div>
      <div class="workspace-actions">
        <button v-if="!note" :disabled="loading || uploading" @click="openConnections">
          保存先を選択
        </button>
        <RouterLink v-if="note" :to="'/learning/pdf-notes/' + note.note_id + '/edit'"
          >編集</RouterLink
        >
        <button
          v-if="note"
          class="quiet-danger"
          :disabled="busy || wordsPane?.busy"
          @click="deletePdf = true"
        >
          削除
        </button>
        <select
          :value="Math.round(width)"
          class="layout-ratio"
          aria-label="画面比率"
          @change="setWidth(Number($event.target.value))"
        >
          <option :value="55">55 : 45</option>
          <option :value="50">50 : 50</option>
          <option :value="65">65 : 35</option>
          <option v-if="![55, 50, 65].includes(Math.round(width))" :value="Math.round(width)">
            カスタム
          </option>
        </select>
        <button :aria-pressed="pdfOnly" class="read-wide" @click="pdfOnly = !pdfOnly">
          {{ pdfOnly ? 'ノートを表示' : 'PDFを広く読む' }}
        </button>
        <button :aria-pressed="expanded" @click="expanded = !expanded">
          {{ expanded ? '通常表示' : '集中表示' }}
        </button>
      </div>
    </header>
    <p v-if="error || writingError" class="workspace-error" role="alert">
      {{ error || writingError }}
    </p>
    <nav class="mobile-tabs" aria-label="表示する領域">
      <button :aria-pressed="tab === 'pdf'" @click="tab = 'pdf'">PDF</button
      ><button :aria-pressed="tab === 'notes'" @click="showNotes">ノート</button>
    </nav>
    <div ref="split" class="workspace-split" :style="{ '--left': width + '%' }">
      <div class="document-area" :class="{ hiddenMobile: tab !== 'pdf' }">
        <PdfDocumentPane
          v-if="note"
          :key="note.note_id"
          v-model="readingPage"
          :src="pdfNoteApi.fileUrl(note.note_id)"
          @loaded="pageCount = $event"
        />
        <PdfDropzone
          v-else
          :busy="uploading"
          :disabled="loading || !connections.milestone_id"
          @file="upload"
        />
      </div>
      <div
        v-show="!pdfOnly"
        class="split-handle"
        role="separator"
        tabindex="0"
        aria-label="PDFとノートの幅を調整"
        aria-orientation="vertical"
        :aria-valuenow="Math.round(width)"
        :aria-valuemin="40"
        :aria-valuemax="80"
        @pointerdown="startResize"
        @keydown.left.prevent="setWidth(width - 2)"
        @keydown.right.prevent="setWidth(width + 2)"
      >
        <span></span>
      </div>
      <section
        v-show="!pdfOnly"
        class="writing-area"
        :class="{ hiddenMobile: tab !== 'notes' }"
        aria-label="ノートを書く"
      >
        <nav class="content-tabs" aria-label="ノートと単語">
          <button :aria-pressed="contentTab === 'notes'" @click="contentTab = 'notes'">
            ノート
          </button>
          <button :aria-pressed="contentTab === 'words'" @click="contentTab = 'words'">単語</button>
        </nav>
        <PdfWordsPane
          v-show="contentTab === 'words'"
          ref="wordsPane"
          :note-id="noteId"
          :page="readingPage"
          :page-count="pageCount"
          @page="readingPage = $event"
        />
        <form v-show="contentTab === 'notes'" class="writing-form" @submit.prevent="save">
          <div class="writing-controls">
            <select
              :value="selected || ''"
              :disabled="busy || loading"
              aria-label="ノートを選ぶ"
              @change="chooseEntry($event.target.value)"
            >
              <option value="">
                ＋ 新しいノート{{ form.question && !selected ? ' · ' + form.question : '' }}
              </option>
              <option v-for="entry in entries" :key="entry.entry_id" :value="entry.entry_id">
                p.{{ entry.page }} ·
                {{
                  entry.entry_id === selected
                    ? form.question || entry.question || 'ノート'
                    : entry.question || 'ノート'
                }}
              </option>
            </select>
            <details
              ref="titlePicker"
              class="title-picker"
              @toggle="openTitlePicker"
              @keydown.esc.prevent.stop="closeTitlePicker"
            >
              <summary aria-label="ノートのタイトルを変更" title="タイトルを変更">✎</summary>
              <div class="note-title-popover">
                <label
                  >ノートのタイトル<input
                    ref="titleField"
                    v-model="titleInput"
                    maxlength="200"
                    :placeholder="defaultTitle"
                    :disabled="busy || loading"
                    @keydown="titleKey"
                /></label>
                <small
                  >{{
                    note
                      ? 'タイトルと本文を一緒に保存します。'
                      : 'PDF登録後に本文と一緒に保存します。'
                  }}空欄の場合は自動で付けます。</small
                >
                <div>
                  <button type="button" :disabled="busy || loading" @click="closeTitlePicker">
                    キャンセル</button
                  ><button type="button" :disabled="busy || loading" @click="applyTitle">
                    {{ note ? '保存' : '適用' }}
                  </button>
                </div>
              </div>
            </details>
            <details class="page-picker" @keydown.esc.prevent.stop="closePagePicker">
              <summary :title="'関連ページ ' + form.page">p.{{ form.page }}⌄</summary>
              <div class="page-link-popover">
                <label
                  >関連ページ<input
                    v-model.number="form.page"
                    type="number"
                    min="1"
                    :max="pageCount || 100000"
                    :disabled="busy" /></label
                ><button type="button" :disabled="busy" @click="form.page = readingPage">
                  表示中のページに設定
                </button>
              </div>
            </details>
          </div>
          <PdfRichEditor
            v-model="form.body"
            v-model:format="form.body_format"
            :disabled="busy || loading"
            @characters="characters = $event"
            @save="save"
          />
          <footer class="writing-footer">
            <span aria-live="polite"
              >{{ draftMessage || (!note ? 'PDFを登録すると保存できます' : '')
              }}<small>{{ characters.toLocaleString() }}文字</small></span
            >
            <div>
              <button
                v-if="selected"
                type="button"
                class="quiet-danger"
                :disabled="busy"
                @click="deleteEntry = true"
              >
                削除</button
              ><button
                class="primary"
                :disabled="busy || loading || !note"
                :title="note ? '保存' : '左側にPDFを登録してください'"
              >
                {{ busy ? '保存中…' : selected ? '更新' : '保存' }}
              </button>
            </div>
          </footer>
        </form>
      </section>
    </div>
    <PdfConnectionsModal
      v-if="connectionsOpen"
      :connections="connections"
      @close="connectionsOpen = false"
      @save="saveConnections"
    />
    <DeleteConfirmModal
      v-if="deletePdf"
      title="PDFノートを削除しますか？"
      :description="'「' + note.title + '」とPDF原本、すべてのノート・単語を削除します。'"
      :busy="deleting"
      :error="error"
      @close="deletePdf = false"
      @confirm="removePdf"
    />
    <DeleteConfirmModal
      v-if="deleteEntry"
      title="このノートを削除しますか？"
      description="選択したノートの本文と下書きを削除します。PDF原本は保持します。"
      :busy="busy"
      :error="writingError"
      @close="deleteEntry = false"
      @confirm="removeSelected"
    />
  </div>
</template>
<script setup>
import { computed, ref, watch, onBeforeUnmount, defineAsyncComponent, nextTick } from 'vue'
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router'
import { useLearning } from '../composables/useLearning'
import { usePdfNoteEntries } from '../composables/usePdfNoteEntries'
import { pdfNoteApi, validatePdfFile, pdfNoteBackLink, clearPdfDrafts } from '../utils/pdfNoteApi'
import PdfDocumentPane from '../components/learning/PdfDocumentPane.vue'
import PdfDropzone from '../components/learning/PdfDropzone.vue'
import PdfConnectionsModal from '../components/learning/PdfConnectionsModal.vue'
import PdfRichEditor from '../components/learning/PdfRichEditor.vue'
const PdfWordsPane = defineAsyncComponent(() => import('../components/learning/PdfWordsPane.vue'))
import DeleteConfirmModal from '../components/DeleteConfirmModal.vue'
import { pdfNoteTitle } from '../utils/pdfNoteTitle'
const route = useRoute(),
  router = useRouter(),
  { state, load } = useLearning()
const contentTab = ref('notes'),
  wordsPane = ref(null)
const connectionsOpen = ref(false)
function openConnections() {
  connectionsOpen.value = true
}
function saveConnections(value) {
  connections.value = { ...value }
  connectionsOpen.value = false
}
const noteId = computed(() => (route.params.id ? String(route.params.id) : '')),
  owner = computed(() => state.owner)
const note = ref(null),
  readingPage = ref(1),
  pageCount = ref(0),
  loading = ref(true),
  uploading = ref(false),
  error = ref(''),
  connections = ref({ roadmap_id: '', milestone_id: '', task_id: '' })
const expanded = ref(false),
  pdfOnly = ref(false),
  width = ref(55),
  split = ref(null),
  tab = ref('pdf'),
  characters = ref(0),
  deletePdf = ref(false),
  deleteEntry = ref(false),
  deleting = ref(false)
const draftScope = computed(
  () => 'new-' + (route.query.task || route.query.milestone || route.query.roadmap || 'all'),
)
const writing = usePdfNoteEntries({ noteId, owner, page: readingPage, pageCount, draftScope })
const {
  entries,
  selected,
  busy,
  error: writingError,
  draftMessage,
  dirty,
  form,
  save: saveEntry,
} = writing
const titlePicker = ref(null),
  titleField = ref(null),
  titleInput = ref('')
const defaultTitle = computed(() => pdfNoteTitle({ ...form, question: '' }, entries.value))
function openTitlePicker() {
  if (!titlePicker.value?.open) return
  titleInput.value = form.question
  nextTick(() => titleField.value?.focus())
}
function closeTitlePicker() {
  if (!titlePicker.value) return
  titlePicker.value.open = false
  titlePicker.value.querySelector('summary')?.focus()
}
async function save() {
  if (busy.value || loading.value) return false
  if (titlePicker.value?.open) form.question = titleInput.value.trim()
  const saved = await saveEntry()
  if (saved && titlePicker.value?.open) closeTitlePicker()
  return saved
}
async function applyTitle() {
  if (busy.value || loading.value) return
  form.question = titleInput.value.trim()
  if (note.value) await save()
  else closeTitlePicker()
}
function titleKey(event) {
  if (event.key !== 'Enter' || event.isComposing || event.keyCode === 229) return
  event.preventDefault()
  applyTitle()
}
watch(selected, () => {
  if (titlePicker.value) titlePicker.value.open = false
})
const backLink = computed(() =>
  note.value ? pdfNoteBackLink(note.value) : pdfNoteBackLink(connections.value),
)
const contextLabel = computed(() => {
  const related = note.value || connections.value
  return [
    state.roadmaps.find((r) => r.roadmap_id === related.roadmap_id)?.title,
    state.milestones.find((m) => m.milestone_id === related.milestone_id)?.title,
  ]
    .filter(Boolean)
    .join(' / ')
})
let revision = 0,
  positionTimer,
  stopResize,
  transferred = null,
  disposed = false
async function initialize() {
  const version = ++revision
  loading.value = true
  error.value = ''
  note.value = null
  pageCount.value = 0
  clearTimeout(positionTimer)
  try {
    await load()
    if (version !== revision || disposed) return
    if (noteId.value) {
      const data = await pdfNoteApi.get(noteId.value)
      if (version !== revision || disposed) return
      note.value = data.note
      readingPage.value = data.note.last_page
      const sourcePage = Number(route.query.page)
      if (Number.isInteger(sourcePage) && sourcePage > 0 && sourcePage <= 100000)
        readingPage.value = sourcePage
      writing.initialize(data.entries)
      if (transferred?.id === noteId.value) {
        writing.restoreTransferred(transferred.form)
        transferred = null
      }
    } else {
      const task = String(route.query.task || ''),
        milestone = String(
          route.query.milestone || state.tasks.find((t) => t.task_id === task)?.milestone_id || '',
        ),
        roadmap = String(
          route.query.roadmap ||
            state.milestones.find((m) => m.milestone_id === milestone)?.roadmap_id ||
            '',
        )
      connections.value = { roadmap_id: roadmap, milestone_id: milestone, task_id: task }
      readingPage.value = 1
      writing.initialize([])
    }
    try {
      const saved = Number(
        localStorage.getItem('pdf-layout:' + owner.value + ':' + (noteId.value || 'new')),
      )
      width.value = Number.isFinite(saved) && saved >= 40 && saved <= 80 ? saved : 55
    } catch {}
    if (!note.value && !connections.value.milestone_id) openConnections()
  } catch (e) {
    if (version === revision) error.value = e.response?.data?.message || e.message
  } finally {
    if (version === revision) loading.value = false
  }
}
watch(
  () => [route.params.id, route.query.milestone, route.query.task, route.query.roadmap],
  initialize,
  { immediate: true },
)
watch(readingPage, (value) => {
  clearTimeout(positionTimer)
  if (note.value && !loading.value)
    positionTimer = setTimeout(
      () =>
        pdfNoteApi.update(note.value.note_id, { last_page: value }).catch(() => {
          error.value = '読んだ位置を保存できませんでした。'
        }),
      500,
    )
})
function chooseEntry(id) {
  writing.choose(id)
  tab.value = 'notes'
}
function showNotes() {
  tab.value = 'notes'
  pdfOnly.value = false
}
function closePagePicker(event) {
  event.currentTarget.open = false
  event.currentTarget.querySelector('summary')?.focus()
}
async function upload(file) {
  if (uploading.value || !connections.value.milestone_id) return
  uploading.value = true
  error.value = ''
  try {
    await validatePdfFile(file)
    const data = await pdfNoteApi.upload(file, {
      title: file.name.replace(/\.pdf$/i, '').slice(0, 200),
      ...connections.value,
    })
    transferred = { id: String(data.note_id), form: writing.transferDraft(String(data.note_id)) }
    await router.replace('/learning/pdf-notes/' + data.note_id)
  } catch (e) {
    error.value = e.response?.data?.message || e.message
  } finally {
    uploading.value = false
  }
}
async function removeSelected() {
  await writing.remove()
  if (!writingError.value) deleteEntry.value = false
}
async function removePdf() {
  deleting.value = true
  error.value = ''
  const destination = backLink.value
  try {
    await pdfNoteApi.remove(noteId.value)
    clearPdfDrafts(owner.value, noteId.value)
    deletePdf.value = false
    dirty.value = false
    deleting.value = false
    await router.push(destination)
  } catch (e) {
    error.value = e.response?.data?.message || e.message
  } finally {
    deleting.value = false
  }
}
function setWidth(value) {
  const maximum = Math.min(80, 100 - (300 / (split.value?.clientWidth || 1000)) * 100)
  width.value = Math.max(40, Math.min(maximum, value))
  try {
    localStorage.setItem(
      'pdf-layout:' + owner.value + ':' + (noteId.value || 'new'),
      String(width.value),
    )
  } catch {}
}
function startResize(event) {
  if (event.button !== 0) return
  event.preventDefault()
  stopResize?.()
  const move = (e) => {
    const rect = split.value.getBoundingClientRect()
    setWidth(((e.clientX - rect.left) / rect.width) * 100)
  }
  stopResize = () => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', stopResize)
    window.removeEventListener('pointercancel', stopResize)
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', stopResize)
  window.addEventListener('pointercancel', stopResize)
}
function unload(event) {
  if (dirty.value || uploading.value || wordsPane.value?.dirty || wordsPane.value?.busy) {
    event.preventDefault()
    event.returnValue = ''
  }
}
function escape(event) {
  if (
    event.key === 'Escape' &&
    !event
      .composedPath()
      .some(
        (node) =>
          node.tagName === 'DIALOG' ||
          node.classList?.contains('tiptap-color-popover') ||
          node.classList?.contains('page-link-popover') ||
          node.classList?.contains('note-title-popover'),
      )
  ) {
    expanded.value = false
    pdfOnly.value = false
  }
}
window.addEventListener('beforeunload', unload)
window.addEventListener('keydown', escape)
onBeforeRouteLeave(() => {
  if (busy.value || wordsPane.value?.busy || deleting.value || (uploading.value && !transferred))
    return false
  if (wordsPane.value?.dirty && !confirm('未保存の単語の入力は破棄されます。移動しますか？'))
    return false
  return (
    !!transferred ||
    !dirty.value ||
    confirm('未保存の本文はこの端末の下書きとして残します。移動しますか？')
  )
})
onBeforeUnmount(() => {
  disposed = true
  revision++
  clearTimeout(positionTimer)
  stopResize?.()
  window.removeEventListener('beforeunload', unload)
  window.removeEventListener('keydown', escape)
})
</script>
<style scoped>
.pdf-workspace {
  height: calc(100dvh - 56px);
  min-height: 460px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  color: #2c415c;
}
.workspace-expanded {
  position: fixed;
  inset: 0;
  z-index: 1000;
  height: 100dvh;
  min-height: 0;
  padding: 12px 16px;
  box-sizing: border-box;
  background: #eef1f5;
}
.workspace-header {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 40px;
  flex-shrink: 0;
}
.workspace-back {
  font-size: 25px;
  text-decoration: none;
  background: white;
  padding: 3px 10px;
  border-radius: 9px;
  color: #6a7d96;
}
.workspace-heading {
  min-width: 0;
  flex: 1;
}
.workspace-heading h1 {
  font-size: 18px;
  line-height: 1.35;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.workspace-heading > span {
  font-size: 10px;
  color: #8997aa;
}
.workspace-actions {
  display: flex;
  gap: 6px;
  align-items: center;
}
.pdf-workspace button,
.workspace-actions a,
.pdf-workspace select {
  font: inherit;
  font-size: 12px;
  border: 1px solid #d9e1ed;
  border-radius: 8px;
  padding: 6px 9px;
  background: white;
  color: #536a87;
  cursor: pointer;
  text-decoration: none;
  min-height: 31px;
  box-sizing: border-box;
}
.pdf-workspace button:disabled {
  opacity: 0.5;
  cursor: default;
}
.pdf-workspace .quiet-danger {
  color: #a34b58;
  border-color: transparent;
}
.workspace-split {
  display: grid;
  grid-template-columns: minmax(0, var(--left)) 12px minmax(0, 1fr);
  flex: 1;
  min-height: 0;
}
.pdf-only .workspace-split {
  grid-template-columns: minmax(0, 1fr);
}
.document-area {
  min-height: 0;
  min-width: 0;
}
.split-handle {
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: col-resize;
  touch-action: none;
}
.split-handle > span {
  width: 3px;
  height: 45px;
  border-radius: 3px;
  background: #b3c0d3;
}
.split-handle:hover > span,
.split-handle:focus > span {
  background: #6486bd;
}
.writing-area {
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
  border: 1px solid #dce4ee;
  border-radius: 12px;
  background: white;
  overflow: hidden;
}
.content-tabs {
  display: flex;
  gap: 4px;
  padding: 10px 18px;
  border-bottom: 1px solid #e3e9f1;
  flex-shrink: 0;
}
.content-tabs button {
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: #708199;
  padding: 7px 16px;
  font: inherit;
  cursor: pointer;
}
.content-tabs button[aria-pressed='true'] {
  background: #edf3ff;
  color: #315cbb;
  font-weight: 600;
}
.writing-form {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 10px 14px 12px;
  flex: 1;
  min-height: 0;
}
.writing-controls {
  display: flex;
  align-items: center;
  gap: 7px;
  flex-shrink: 0;
  padding-bottom: 4px;
}
.title-picker {
  position: relative;
  flex-shrink: 0;
}
.title-picker summary {
  list-style: none;
  cursor: pointer;
  padding: 4px 8px;
  border: 1px solid #d9e1ed;
  border-radius: 7px;
  color: #536a87;
  font-size: 17px;
  line-height: 1.2;
}
.title-picker summary::-webkit-details-marker {
  display: none;
}
.note-title-popover {
  position: absolute;
  right: 0;
  top: calc(100% + 8px);
  z-index: 10;
  width: min(280px, 65vw);
  padding: 14px;
  border: 1px solid #d9e1ed;
  border-radius: 10px;
  background: white;
  box-shadow: 0 8px 24px #14213820;
}
.note-title-popover label {
  display: grid;
  gap: 7px;
  font-size: 12px;
  color: #536a87;
}
.note-title-popover input {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  padding: 8px;
  border: 1px solid #cdd8e8;
  border-radius: 6px;
  font: inherit;
}
.note-title-popover small {
  display: block;
  margin: 8px 0;
  color: #708199;
  font-size: 11px;
}
.note-title-popover > div {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
}
.writing-controls > select {
  flex: 1;
  min-width: 0;
  border-color: transparent;
  font-size: 13px;
  padding-left: 4px;
  background: #fff;
}
.page-picker {
  position: relative;
  flex-shrink: 0;
  font-size: 11px;
  color: #8795a8;
}
.page-picker summary {
  cursor: pointer;
  list-style: none;
  padding: 7px;
  border-radius: 7px;
}
.page-picker summary:hover {
  background: #f2f5fa;
}
.page-picker summary::-webkit-details-marker {
  display: none;
}
.page-link-popover {
  position: absolute;
  right: 0;
  top: 100%;
  z-index: 30;
  width: 210px;
  padding: 15px;
  background: white;
  border: 1px solid #e0e6ef;
  border-radius: 10px;
  box-shadow: 0 8px 24px #13274020;
}
.page-link-popover label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
}
.page-link-popover input {
  width: 60px;
  border: 1px solid #d6e0ee;
  border-radius: 7px;
  font: inherit;
  padding: 5px;
}
.page-link-popover button {
  margin-top: 12px;
  font-size: 11px;
  width: 100%;
}
.writing-footer {
  display: flex;
  align-items: center;
  gap: 10px;
  justify-content: space-between;
  border-top: 1px solid #e8edf4;
  padding-top: 9px;
  margin-top: 3px;
  flex-shrink: 0;
}
.writing-footer > span {
  flex: 1;
  min-width: 0;
  font-size: 10px;
  color: #90a0b5;
  line-height: 1.5;
}
.writing-footer small {
  font-size: 10px;
  display: block;
}
.writing-footer > div {
  display: flex;
  gap: 5px;
  flex-shrink: 0;
}
.writing-footer button {
  white-space: nowrap;
}
.pdf-workspace .primary {
  background: #315cbb;
  color: white;
  border-color: #315cbb;
  padding-inline: 17px;
}
.workspace-error {
  font-size: 12px;
  color: #a34350;
  margin: 0;
}
.mobile-tabs {
  display: none;
}
@media (max-width: 1000px) {
  .workspace-actions .read-wide {
    display: none;
  }
  .workspace-heading h1 {
    font-size: 16px;
  }
  .workspace-actions {
    gap: 4px;
  }
}
@media (max-width: 850px) {
  .pdf-workspace {
    height: calc(100dvh - 100px);
    min-height: 410px;
  }
  .workspace-expanded {
    height: 100dvh;
    min-height: 0;
    padding: 10px;
  }
  .workspace-split {
    display: flex;
  }
  .document-area,
  .writing-area {
    flex: 1;
  }
  .hiddenMobile {
    display: none !important;
  }
  .split-handle,
  .layout-ratio {
    display: none;
  }
  .mobile-tabs {
    display: flex;
    gap: 6px;
  }
  .workspace-heading > span {
    display: none;
  }
  .workspace-heading h1 {
    max-width: 150px;
  }
  .workspace-actions a,
  .workspace-actions button {
    font-size: 11px;
    padding: 5px 7px;
  }
  .writing-form {
    padding: 10px 12px;
  }
  .workspace-header {
    gap: 7px;
    flex-wrap: wrap;
  }
}
</style>
