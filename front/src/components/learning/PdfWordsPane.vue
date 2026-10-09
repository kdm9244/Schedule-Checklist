<template>
  <div class="words-pane">
    <div class="word-toolbar">
      <select
        v-model="scope"
        class="word-scope"
        aria-label="単語の表示ページ"
        :disabled="busy || loading || editing"
      >
        <option value="current">表示中のページ · p.{{ page }}</option>
        <option value="all">すべての単語 · {{ words.length }}件</option>
        <option v-for="group in pageOptions" :key="group.page" :value="String(group.page)">
          {{ group.page }}ページ · {{ group.count }}件
        </option>
      </select>
      <button
        v-if="!editing"
        class="word-tool-button"
        :disabled="busy || loading || !groups.length"
        @click="startEdit"
      >
        編集
      </button>
    </div>
    <div v-if="editing" class="word-edit-actions">
      <button
        class="word-tool-button danger"
        :disabled="busy || !checked.length"
        @click="pendingDelete = true"
      >
        選択を削除 ({{ checked.length }})
      </button>
      <button class="word-tool-button" :disabled="busy" @click="cancelEdit">キャンセル</button>
      <button class="word-tool-button primary" :disabled="busy" @click="saveEdits">
        {{ busy ? '保存中…' : '保存' }}
      </button>
    </div>
    <p v-if="error" class="word-error" role="alert">{{ error }}</p>
    <p v-if="!noteId" class="word-hint">左側にPDFを登録すると単語を保存できます。</p>
    <div class="word-list" :aria-busy="loading">
      <p v-if="loading" class="word-hint">読み込み中…</p>
      <p v-else-if="!groups.length" class="word-hint">
        このページの単語はありません。表の1行を下に貼り付けて、Enterで保存してください。
      </p>
      <section v-for="group in groups" :key="group.page">
        <h3 v-if="scope === 'all'" class="word-page-heading">
          <button @click="$emit('page', group.page)">{{ group.page }}ページ</button
          ><small>{{ group.items.length }}件</small>
        </h3>
        <table class="word-table" :class="{ 'is-editing': editing }">
          <colgroup>
            <col v-if="editing" class="check-column" />
            <col class="word-column" />
            <col class="reading-column" />
            <col class="meaning-column" />
          </colgroup>
          <thead>
            <tr>
              <th v-if="editing" class="check-cell">
                <input
                  type="checkbox"
                  :aria-label="group.page + 'ページの単語をすべて選択'"
                  :checked="group.items.every((item) => checked.includes(item.word_id))"
                  :disabled="busy"
                  @change="toggleGroup(group, $event.target.checked)"
                />
              </th>
              <th scope="col">単語</th>
              <th scope="col">読み方</th>
              <th scope="col">意味</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in group.items" :key="item.word_id" class="word-row">
              <template v-if="editing">
                <td class="check-cell">
                  <input
                    v-model="checked"
                    type="checkbox"
                    :value="item.word_id"
                    :aria-label="item.word + 'を選択'"
                    :disabled="busy"
                  />
                </td>
                <td>
                  <textarea
                    v-model="drafts[item.word_id].word"
                    :aria-label="item.word + '：単語'"
                    rows="2"
                    maxlength="200"
                    :disabled="busy"
                  /><label class="word-page-edit"
                    >p.<input
                      v-model.number="drafts[item.word_id].page"
                      :aria-label="item.word + '：関連ページ'"
                      type="number"
                      min="1"
                      :max="pageCount || 100000"
                      :disabled="busy"
                  /></label>
                </td>
                <td>
                  <textarea
                    v-model="drafts[item.word_id].reading"
                    :aria-label="item.word + '：読み方'"
                    rows="2"
                    maxlength="200"
                    :disabled="busy"
                  />
                </td>
                <td>
                  <textarea
                    v-model="drafts[item.word_id].meaning"
                    :aria-label="item.word + '：意味'"
                    rows="2"
                    maxlength="1000"
                    :disabled="busy"
                  />
                </td>
              </template>
              <template v-else
                ><td class="word-cell">{{ item.word }}</td>
                <td class="word-reading">{{ item.reading || '—' }}</td>
                <td>{{ item.meaning }}</td></template
              >
            </tr>
          </tbody>
        </table>
      </section>
    </div>
    <DeleteConfirmModal
      v-if="pendingDelete"
      title="選択した単語を削除しますか？"
      :description="checked.length + '件の単語を削除します。残りの編集内容は保持します。'"
      :busy="busy"
      :error="error"
      @close="pendingDelete = false"
      @confirm="removeSelected"
    />
    <form class="word-input" @submit.prevent="add">
      <label for="pdf-word-paste"
        >単語・読み方・意味をまとめて貼り付け <small>保存先 p.{{ page }}</small></label
      >
      <textarea
        id="pdf-word-paste"
        ref="input"
        v-model="paste"
        rows="1"
        maxlength="1600"
        :disabled="busy || loading || !noteId || !!editing"
        placeholder="個人会員向け　こじんかいいんむけ　개인 회원 대상"
        @keydown="enter"
      />
      <div>
        <span aria-live="polite">{{ message || 'Enterで保存 · 読み方は省略可' }}</span
        ><button :disabled="busy || loading || !noteId || !paste.trim() || !!editing">
          {{ busy ? '保存中…' : '追加' }}
        </button>
      </div>
    </form>
  </div>
</template>
<script setup>
import { computed, nextTick, reactive, ref, watch } from 'vue'
import DeleteConfirmModal from '../DeleteConfirmModal.vue'
import { pdfNoteApi } from '../../utils/pdfNoteApi'
import { parseWordPaste } from '../../utils/pdfWordPaste'
const props = defineProps({
  noteId: { type: String, default: '' },
  page: { type: Number, default: 1 },
  pageCount: { type: Number, default: 0 },
})
defineEmits(['page'])
const scope = ref('current')
const words = ref([]),
  paste = ref(''),
  error = ref(''),
  message = ref(''),
  busy = ref(false),
  loading = ref(false),
  input = ref(null),
  editing = ref(false),
  pendingDelete = ref(false)
const drafts = reactive({}),
  checked = ref([]),
  editIds = ref([])
const pageOptions = computed(() => {
  const counts = new Map()
  for (const word of words.value) counts.set(word.page, (counts.get(word.page) || 0) + 1)
  return [...counts].sort((a, b) => a[0] - b[0]).map(([page, count]) => ({ page, count }))
})
const groups = computed(() => {
  const pages = new Map()
  const target = scope.value === 'current' ? props.page : Number(scope.value)
  for (const word of words.value) {
    if (
      editing.value
        ? !editIds.value.includes(word.word_id)
        : scope.value !== 'all' && word.page !== target
    )
      continue
    if (!pages.has(word.page)) pages.set(word.page, [])
    pages.get(word.page).push(word)
  }
  return [...pages].sort((a, b) => a[0] - b[0]).map(([page, items]) => ({ page, items }))
})
watch(pageOptions, (options) => {
  if (
    !['all', 'current'].includes(scope.value) &&
    !options.some((group) => String(group.page) === scope.value)
  )
    scope.value = 'current'
})
const dirty = computed(() => !!paste.value.trim() || !!editing.value)
defineExpose({ dirty, busy })
let generation = 0
watch(
  () => props.noteId,
  async (id) => {
    const current = ++generation
    words.value = []
    scope.value = 'current'
    error.value = ''
    message.value = ''
    cancelEdit()
    loading.value = false
    if (!id) return
    loading.value = true
    try {
      const result = await pdfNoteApi.words(id)
      if (current === generation) words.value = result
    } catch (e) {
      if (current === generation)
        error.value = e.response?.data?.message || '単語を読み込めませんでした。'
    } finally {
      if (current === generation) loading.value = false
    }
  },
  { immediate: true },
)
function enter(event) {
  if (event.key !== 'Enter' || event.isComposing || event.keyCode === 229) return
  event.preventDefault()
  add()
}
async function add() {
  if (busy.value || loading.value || !props.noteId || editing.value) return
  error.value = ''
  message.value = ''
  let value
  try {
    value = parseWordPaste(paste.value)
  } catch (e) {
    error.value = e.message
    return
  }
  if (!value) return
  busy.value = true
  const destinationPage = props.page
  try {
    const saved = await pdfNoteApi.saveWord(props.noteId, null, { ...value, page: destinationPage })
    words.value.push(saved)
    if (!['all', 'current'].includes(scope.value)) scope.value = String(destinationPage)
    paste.value = ''
    message.value = '保存しました。'
    await nextTick()
  } catch (e) {
    error.value = e.response?.data?.message || '保存できませんでした。入力内容は保持しています。'
  } finally {
    busy.value = false
    await nextTick()
    input.value?.focus()
  }
}
function startEdit() {
  editIds.value = groups.value.flatMap((group) => group.items.map((item) => item.word_id))
  for (const item of words.value)
    if (editIds.value.includes(item.word_id)) drafts[item.word_id] = { ...item }
  checked.value = []
  error.value = ''
  message.value = ''
  editing.value = true
}
function cancelEdit() {
  editing.value = false
  checked.value = []
  editIds.value = []
  pendingDelete.value = false
  for (const id of Object.keys(drafts)) delete drafts[id]
  error.value = ''
}
function toggleGroup(group, selected) {
  const ids = group.items.map((item) => item.word_id)
  checked.value = selected
    ? [...new Set([...checked.value, ...ids])]
    : checked.value.filter((id) => !ids.includes(id))
}
async function saveEdits() {
  if (busy.value) return
  error.value = ''
  const items = words.value.filter((item) => editIds.value.includes(item.word_id))
  for (const item of items) {
    const draft = drafts[item.word_id]
    if (
      !draft.word.trim() ||
      !draft.meaning.trim() ||
      !Number.isInteger(draft.page) ||
      draft.page < 1 ||
      draft.page > (props.pageCount || 100000)
    ) {
      error.value = '単語と意味は必須です。関連ページも確認してください。'
      return
    }
  }
  busy.value = true
  let savedCount = 0
  try {
    for (const item of items) {
      const draft = drafts[item.word_id]
      if (['word', 'reading', 'meaning', 'page'].every((key) => draft[key] === item[key])) continue
      const saved = await pdfNoteApi.saveWord(props.noteId, item.word_id, draft)
      Object.assign(item, saved)
      Object.assign(draft, saved)
      savedCount++
    }
    cancelEdit()
    message.value = '保存しました。'
  } catch (e) {
    error.value =
      savedCount +
      '件を保存しました。残りの入力は保持しています。' +
      (e.response?.data?.message || 'もう一度保存してください。')
  } finally {
    busy.value = false
  }
}
async function removeSelected() {
  if (busy.value || !checked.value.length) return
  busy.value = true
  error.value = ''
  let removed = 0
  try {
    for (const id of [...checked.value]) {
      await pdfNoteApi.removeWord(props.noteId, id)
      words.value = words.value.filter((item) => item.word_id !== id)
      checked.value = checked.value.filter((value) => value !== id)
      editIds.value = editIds.value.filter((value) => value !== id)
      delete drafts[id]
      removed++
    }
    pendingDelete.value = false
    message.value = removed + '件を削除しました。'
    if (!editIds.value.length) cancelEdit()
  } catch (e) {
    error.value =
      removed +
      '件を削除しました。残りは削除されていません。' +
      (e.response?.data?.message || '再試行してください。')
  } finally {
    busy.value = false
  }
}
</script>
<style scoped>
.words-pane {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  min-width: 0;
  width: 100%;
  box-sizing: border-box;
  padding: 10px 14px 16px;
  gap: 10px;
}
.word-toolbar {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-shrink: 0;
}
.word-scope {
  flex: 1;
  width: 0;
  min-width: 0;
  border: 1px solid #d9e1ed;
  border-radius: 8px;
  padding: 7px 9px;
  color: #536a87;
  background: white;
  font: inherit;
  font-size: 12px;
  min-height: 31px;
}
.word-tool-button {
  border: 1px solid #d9e1ed;
  border-radius: 7px;
  background: white;
  color: #536a87;
  font: inherit;
  font-size: 12px;
  padding: 6px 10px;
  cursor: pointer;
  white-space: nowrap;
}
.word-edit-actions {
  display: flex;
  gap: 6px;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  flex-shrink: 0;
}
.word-edit-actions .danger {
  color: #b42335;
  margin-right: auto;
}
.word-edit-actions .primary {
  background: #315cbb;
  border-color: #315cbb;
  color: white;
}
.word-page-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 10px 0 0;
  padding: 6px 0;
  border-bottom: 1px solid #e3e9f1;
  font-size: 13px;
  color: #708199;
}
.word-page-heading button {
  border: 0;
  background: transparent;
  color: #315cbb;
  font: inherit;
  cursor: pointer;
}
.word-page-heading small {
  font-weight: normal;
}
.word-list {
  flex: 1;
  min-height: 0;
  min-width: 0;
  width: 100%;
  overflow-y: auto;
  overflow-x: hidden;
}
.word-table {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  table-layout: fixed;
  border-collapse: collapse;
  font-size: 13px;
  line-height: 1.6;
}
.word-column {
  width: 25%;
}
.reading-column {
  width: 40%;
}
.meaning-column {
  width: 35%;
}
.check-column {
  width: 28px;
}
.is-editing .word-column {
  width: calc(25% - 7px);
}
.is-editing .reading-column {
  width: calc(40% - 11.2px);
}
.is-editing .meaning-column {
  width: calc(35% - 9.8px);
}
.word-table th {
  text-align: left;
  font-weight: 500;
  font-size: 11px;
  color: #708199;
  padding: 8px 6px;
  border-bottom: 1px solid #dce4ee;
}
.word-table td {
  padding: 10px 6px;
  border-bottom: 1px solid #e9edf4;
  vertical-align: top;
  overflow-wrap: anywhere;
  word-break: normal;
  white-space: normal;
}
.word-table th:first-child,
.word-table td:first-child {
  padding-left: 0;
}
.word-table th:last-child,
.word-table td:last-child {
  padding-right: 0;
}
.word-cell {
  font-weight: 600;
  color: #26364c;
}
.word-row:hover {
  background: #f8fafd;
}
.word-reading,
.word-hint {
  color: #708199;
}
.word-table .check-cell {
  padding: 12px 4px 10px 0;
  text-align: center;
}
.check-cell input {
  width: 16px;
  height: 16px;
  accent-color: #315cbb;
  cursor: pointer;
  margin: 0;
}
.word-table textarea {
  display: block;
  box-sizing: border-box;
  min-width: 0;
  width: 100%;
  border: 1px solid #cdd8e8;
  border-radius: 6px;
  padding: 6px;
  font: inherit;
  line-height: 1.5;
  resize: vertical;
}
.word-page-edit {
  display: flex;
  gap: 3px;
  align-items: center;
  margin-top: 5px;
  font-size: 11px;
  color: #708199;
}
.word-page-edit input {
  box-sizing: border-box;
  width: 48px;
  min-width: 0;
  border: 1px solid #cdd8e8;
  border-radius: 5px;
  padding: 3px;
  font: inherit;
}
.word-error {
  color: #b42335;
  margin: 0;
  font-size: 13px;
}
.word-input {
  border-top: 1px solid #e3e9f1;
  padding-top: 12px;
  flex-shrink: 0;
}
.word-input label {
  display: block;
  font-size: 13px;
  margin-bottom: 8px;
}
.word-input label small {
  float: right;
  font-weight: normal;
  color: #708199;
}
.word-input textarea {
  box-sizing: border-box;
  width: 100%;
  border: 1px solid #cdd8e8;
  border-radius: 8px;
  padding: 10px;
  font: inherit;
  resize: vertical;
  min-height: 40px;
  max-height: 100px;
  font-size: 13px;
  line-height: 1.5;
}
.word-input > div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 8px;
}
.word-input span {
  font-size: 12px;
  color: #708199;
}
.word-input button {
  border: 0;
  background: #315cbb;
  color: white;
  border-radius: 8px;
  padding: 9px 18px;
  cursor: pointer;
}
button:disabled {
  opacity: 0.5;
  cursor: default;
}
</style>
