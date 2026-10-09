<template>
  <div class="note-browser unified-notes">
    <header class="notes-heading">
      <div class="notes-heading-title">
        <h2>{{ heading }}</h2>
        <span class="notes-count">{{ result.available }}</span>
      </div>
      <div class="notes-create-actions">
        <RouterLink class="create-regular" :to="regularLink">＋ 通常ノートを書く</RouterLink
        ><RouterLink class="create-pdf" :to="pdfLink">＋ PDFノートを追加</RouterLink>
      </div>
    </header>
    <p v-if="error" class="learning-error" role="alert">
      {{ error }} <button @click="fetchPage">再試行</button>
    </p>
    <p v-if="loading" class="notes-loading" role="status">ノートを読み込み中…</p>
    <template v-if="result.available > 0">
      <div class="notes-tools">
        <nav class="note-kind-tabs" aria-label="ノートの種類">
          <button
            v-for="k in kinds"
            :key="k.value"
            :aria-pressed="applied.kind === k.value"
            @click="changeKind(k.value)"
          >
            {{ k.label }}
          </button>
        </nav>
        <form class="notes-search" @submit.prevent="apply">
          <input
            v-model="draft.q"
            type="search"
            maxlength="200"
            aria-label="ノートを検索"
            placeholder="タイトル・本文を検索"
          /><button class="search-button" aria-label="検索">検索</button
          ><select v-model="draft.order" aria-label="並び順" @change="apply">
            <option value="newest">新しい順</option>
            <option value="oldest">古い順</option></select
          ><button type="button" :aria-expanded="filtersOpen" @click="filtersOpen = !filtersOpen">
            絞り込み{{ filterCount ? ' (' + filterCount + ')' : '' }}
          </button>
        </form>
      </div>
      <div v-if="filtersOpen" class="note-filters">
        <label>日付（開始）<input v-model="draft.from" type="date" @change="apply" /></label
        ><label>終了<input v-model="draft.to" type="date" @change="apply" /></label
        ><label
          >入力形式<select v-model="draft.mode" @change="apply">
            <option value="">すべて</option>
            <option value="plain">通常入力</option>
            <option value="markdown">Markdown</option>
          </select></label
        ><button @click="reset">条件をリセット</button
        ><small>PDFの日付は登録日です。入力形式の指定時は通常ノートのみ表示します。</small>
      </div>
      <template v-if="!loading && !error"
        ><p v-if="applied.q || filterCount" class="notes-result">
          {{ result.total }}件が見つかりました
        </p>
        <div class="unified-note-list">
          <article
            v-for="item in result.items"
            :key="item.kind + item.item_id"
            class="unified-note-row"
          >
            <RouterLink :to="itemLink(item)" class="note-main-link"
              ><span class="note-type-icon" :class="{ pdf: item.kind === 'pdf' }">{{
                item.kind === 'pdf' ? 'PDF' : '▤'
              }}</span>
              <div class="note-row-content">
                <strong>{{ item.title }}</strong
                ><span
                  ><small class="note-type-label">{{
                    item.kind === 'pdf' ? 'PDFノート' : '通常ノート'
                  }}</small
                  ><span>{{ item.study_date }}</span
                  ><span v-if="item.kind === 'pdf'"
                    >{{ (item.file_size / 1048576).toFixed(1) }} MB ·
                    {{ item.last_page }}ページから再開</span
                  ></span
                >
              </div>
              <span class="note-open-arrow">›</span></RouterLink
            ><RouterLink class="note-edit" :to="editLink(item)">編集</RouterLink
            ><button
              v-if="item.kind === 'pdf'"
              class="note-delete"
              :aria-label="item.title + 'を削除'"
              @click="requestDelete(item)"
            >
              削除
            </button>
          </article>
        </div>
        <p v-if="!result.items.length" class="notes-no-results">
          条件に一致するノートがありません。<button @click="reset">条件をリセット</button>
        </p>
        <nav v-if="result.pages > 1" class="notes-pagination" aria-label="ノート一覧のページ">
          <button :disabled="result.page <= 1" @click="go(result.page - 1)">‹ 前へ</button
          ><span>{{ result.page }} / {{ result.pages }}</span
          ><button :disabled="result.page >= result.pages" @click="go(result.page + 1)">
            次へ ›
          </button>
        </nav>
      </template>
    </template>
    <div v-else-if="!loading && !error" class="notes-empty">
      <span class="empty-note-icon" aria-hidden="true">▤</span>
      <h3>学びをノートに残しましょう</h3>
      <p>
        自由に書く通常ノートと、資料を読みながら書くPDFノート。<br />右上のボタンから始められます。
      </p>
    </div>
    <DeleteConfirmModal
      v-if="deleteTarget"
      title="PDFノートを削除しますか？"
      :description="
        '「' + deleteTarget.title + '」のPDF原本、保存したノートとこの端末の下書きを削除します。'
      "
      :busy="deleting"
      :error="deleteError"
      @close="deleteTarget = null"
      @confirm="removePdf"
    />
  </div>
</template>
<script setup>
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import axios from 'axios'
import { useLearning, learningError } from '../../composables/useLearning'
import DeleteConfirmModal from '../DeleteConfirmModal.vue'
import { pdfNoteApi, clearPdfDrafts } from '../../utils/pdfNoteApi'
const props = defineProps({
  milestoneId: String,
  taskId: String,
  roadmapId: String,
  heading: { type: String, default: '学習ノート' },
  initialKind: { type: String, default: 'all' },
})
const route = useRoute(),
  { state } = useLearning(),
  defaults = () => ({
    q: '',
    from: '',
    to: '',
    mode: '',
    kind: props.initialKind,
    order: 'newest',
    page: 1,
  })
const draft = reactive(defaults()),
  applied = ref(defaults()),
  loading = ref(false),
  error = ref(''),
  result = ref({ items: [], total: 0, page: 1, pages: 1, available: 0 })
const filtersOpen = ref(false),
  deleteTarget = ref(null),
  deleting = ref(false),
  deleteError = ref('')
const kinds = [
  { value: 'all', label: 'すべて' },
  { value: 'regular', label: '通常ノート' },
  { value: 'pdf', label: 'PDFノート' },
]
const filterCount = computed(
  () => [applied.value.from, applied.value.to, applied.value.mode].filter(Boolean).length,
)
const contextMilestone = computed(
  () =>
    props.milestoneId || state.tasks.find((t) => t.task_id === props.taskId)?.milestone_id || '',
)
const contextRoadmap = computed(
  () =>
    props.roadmapId ||
    state.milestones.find((m) => m.milestone_id === contextMilestone.value)?.roadmap_id ||
    '',
)
const regularLink = computed(() => ({
  path: '/learning/records/new',
  query: {
    task: props.taskId,
    milestone: contextMilestone.value || undefined,
    roadmap: contextRoadmap.value || undefined,
  },
}))
const pdfLink = computed(() => ({
  path: '/learning/pdf-notes/new',
  query: regularLink.value.query,
}))
let controller,
  revision = 0,
  storageKey = ''
function remember() {
  try {
    sessionStorage.setItem(storageKey, JSON.stringify(applied.value))
  } catch {}
}
async function fetchPage() {
  controller?.abort()
  controller = new AbortController()
  const version = ++revision
  loading.value = true
  error.value = ''
  try {
    const data = await pdfNoteApi.library(
      {
        ...applied.value,
        milestone_id: props.milestoneId,
        task_id: props.taskId,
        roadmap_id: props.roadmapId,
      },
      controller.signal,
    )
    if (version !== revision) return
    result.value = data
    applied.value.page = data.page
    remember()
  } catch (e) {
    if (version === revision && !axios.isCancel(e)) error.value = learningError(e)
  } finally {
    if (version === revision) loading.value = false
  }
}
function apply() {
  applied.value = { ...draft, page: 1 }
  remember()
  fetchPage()
}
function changeKind(kind) {
  draft.kind = kind
  apply()
}
function go(page) {
  applied.value.page = page
  remember()
  fetchPage()
}
function reset() {
  Object.assign(draft, defaults(), { kind: 'all' })
  apply()
}
function itemLink(item) {
  return '/learning/' + (item.kind === 'pdf' ? 'pdf-notes/' : 'records/') + item.item_id
}
function editLink(item) {
  return itemLink(item) + '/edit'
}
function requestDelete(item) {
  deleteTarget.value = item
  deleteError.value = ''
}
async function removePdf() {
  deleting.value = true
  deleteError.value = ''
  try {
    const id = deleteTarget.value.item_id
    await pdfNoteApi.remove(id)
    clearPdfDrafts(state.owner, id)
    deleteTarget.value = null
    await fetchPage()
  } catch (e) {
    deleteError.value = learningError(e)
  } finally {
    deleting.value = false
  }
}
watch(
  () => [state.owner, state.loaded, props.milestoneId, props.taskId, props.roadmapId],
  () => {
    storageKey =
      'learning-note-library:' +
      state.owner +
      ':' +
      route.path +
      ':' +
      (props.taskId || props.milestoneId || props.roadmapId || 'all')
    let restored
    try {
      restored = JSON.parse(sessionStorage.getItem(storageKey) || 'null')
    } catch {}
    Object.assign(draft, defaults(), restored || {})
    applied.value = { ...draft }
    if (state.loaded) fetchPage()
  },
  { immediate: true },
)
watch(
  () => state.records,
  () => {
    if (state.loaded) fetchPage()
  },
)
onBeforeUnmount(() => {
  controller?.abort()
  revision++
})
</script>
<style scoped>
.notes-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 14px;
  margin-bottom: 22px;
  flex-wrap: wrap;
}
.notes-heading-title {
  display: flex;
  align-items: center;
  gap: 10px;
}
.notes-heading h2 {
  font-size: 19px;
  margin: 0;
  color: #263a55;
}
.notes-count {
  font-size: 12px;
  background: #eff3fa;
  color: #607596;
  padding: 4px 8px;
  border-radius: 7px;
}
.note-edit {
  font-size: 11px;
  color: #7086a4;
  text-decoration: none;
  padding: 5px 7px;
}
.notes-create-actions {
  display: flex;
  gap: 8px;
}
.unified-notes button,
.unified-notes select,
.create-regular,
.create-pdf {
  font: inherit;
  font-size: 13px;
  border: 1px solid #d6dfec;
  border-radius: 9px;
  background: white;
  color: #4c617e;
  padding: 9px 12px;
  cursor: pointer;
  text-decoration: none;
  line-height: 1.5;
}
.unified-notes button:disabled {
  opacity: 0.5;
  cursor: default;
}
.unified-notes .create-pdf {
  background: #315cbb;
  color: white;
  border-color: #315cbb;
}
.create-regular {
  color: #315cbb;
}
.notes-tools {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
  padding-bottom: 16px;
  border-bottom: 1px solid #e7edf5;
}
.note-kind-tabs {
  display: flex;
  gap: 3px;
  background: #f1f4f9;
  border-radius: 10px;
  padding: 3px;
}
.note-kind-tabs button {
  border: 0;
  background: transparent;
  padding: 7px 11px;
  color: #75839a;
}
.note-kind-tabs button[aria-pressed='true'] {
  background: white;
  color: #315cbb;
  box-shadow: 0 1px 4px #273d6010;
}
.notes-search {
  display: flex;
  gap: 7px;
  align-items: center;
  flex-wrap: wrap;
}
.notes-search input {
  font: inherit;
  font-size: 13px;
  width: 220px;
  max-width: 100%;
  padding: 10px 12px;
  border: 1px solid #d6dfec;
  border-radius: 9px;
}
.notes-search button,
.notes-search select {
  font-size: 12px;
  padding: 9px 10px;
}
.notes-search .search-button {
  border-color: transparent;
  background: #f1f5fb;
  color: #486b9d;
}
.note-filters {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  align-items: end;
  background: #f8fafd;
  padding: 14px;
  border-radius: 10px;
  margin-top: 14px;
}
.note-filters label {
  display: grid;
  gap: 6px;
  font-size: 12px;
}
.note-filters input {
  font: inherit;
  padding: 8px;
  border: 1px solid #d6dfec;
  border-radius: 7px;
}
.note-filters small {
  width: 100%;
  font-size: 11px;
  color: #8491a5;
}
.unified-note-row {
  display: flex;
  align-items: center;
  border-bottom: 1px solid #edf1f6;
}
.note-main-link {
  display: flex;
  align-items: center;
  gap: 14px;
  flex: 1;
  min-width: 0;
  padding: 18px 0;
  color: #2c415e;
  text-decoration: none;
}
.note-main-link:hover strong {
  color: #315cbb;
}
.note-type-icon {
  width: 42px;
  height: 46px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  border-radius: 10px;
  background: #f0f4f9;
  color: #8798b1;
  font-size: 22px;
}
.note-type-icon.pdf {
  font-size: 10px;
  letter-spacing: 0.04em;
  font-weight: 700;
  background: #eaf0fc;
  color: #4b70ba;
}
.note-row-content {
  min-width: 0;
  flex: 1;
}
.note-row-content strong {
  display: block;
  font-size: 15px;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.note-row-content > span {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  font-size: 11px;
  color: #8a96a8;
  margin-top: 7px;
  align-items: center;
}
.note-type-label {
  font-size: 10px;
  color: #6d7f9b;
}
.note-open-arrow {
  font-size: 23px;
  color: #9aa9bd;
}
.unified-notes .note-delete {
  margin-left: 12px;
  font-size: 11px;
  color: #99a4b5;
  padding: 5px 7px;
  border-color: transparent;
}
.note-delete:hover {
  color: #b54250;
}
.notes-empty {
  text-align: center;
  padding: 30px 12px 22px;
  color: #8491a6;
}
.empty-note-icon {
  display: inline-grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border-radius: 14px;
  background: #f1f5fb;
  font-size: 26px;
  color: #8ca3c6;
}
.notes-empty h3 {
  font-size: 16px;
  color: #5b6e89;
  margin: 16px 0 9px;
}
.notes-empty p {
  font-size: 13px;
  line-height: 1.9;
  margin: 0;
}
.notes-loading,
.notes-no-results,
.notes-result {
  font-size: 13px;
  color: #8391a6;
  padding: 14px 0;
}
.notes-pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 14px;
  margin-top: 20px;
  font-size: 12px;
  color: #7a8ca5;
}
@media (max-width: 700px) {
  .notes-heading {
    align-items: flex-start;
  }
  .note-edit {
    font-size: 11px;
    color: #7086a4;
    text-decoration: none;
    padding: 5px 7px;
  }
  .notes-create-actions {
    width: 100%;
  }
  .notes-create-actions > * {
    flex: 1;
    text-align: center;
    padding: 9px 6px;
  }
  .notes-tools {
    gap: 12px;
  }
  .notes-search {
    width: 100%;
  }
  .notes-search input {
    flex: 1;
    min-width: 110px;
    width: 140px;
  }
  .note-row-content > span {
    gap: 6px;
  }
  .notes-empty {
    padding: 24px 0;
  }
  .notes-empty p {
    font-size: 12px;
  }
}
</style>
