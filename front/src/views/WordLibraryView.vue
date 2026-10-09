<template>
  <main class="word-library">
    <header>
      <div>
        <h1>単語帳</h1>
        <p>PDFで保存した単語をまとめて確認・整理します。</p>
      </div>
      <span>{{ data.total }}単語 · {{ data.source_count }}出典</span>
    </header>
    <form class="word-filters" @submit.prevent="load(1)">
      <label
        >学習目標<select
          v-model="filters.roadmap_id"
          :disabled="busy"
          @change="changeFilter('roadmap_id')"
        >
          <option value="">すべて</option>
          <option v-for="item in data.facets.roadmaps" :key="item.id" :value="item.id">
            {{ item.title }}
          </option>
        </select></label
      >
      <label
        >小さな目標<select
          v-model="filters.milestone_id"
          :disabled="busy"
          @change="changeFilter('milestone_id')"
        >
          <option value="">すべて</option>
          <option v-for="item in data.facets.milestones" :key="item.id" :value="item.id">
            {{ item.title }}
          </option>
        </select></label
      >
      <label
        >PDF<select v-model="filters.note_id" :disabled="busy" @change="changeFilter('note_id')">
          <option value="">すべて</option>
          <option v-for="item in data.facets.pdfs" :key="item.id" :value="item.id">
            {{ item.title }}
          </option>
        </select></label
      >
      <label
        >ページ<select v-model="filters.pdf_page" :disabled="busy" @change="load(1)">
          <option value="">すべて</option>
          <option v-for="page in data.facets.pages" :key="page" :value="page">p.{{ page }}</option>
        </select></label
      >
      <label class="word-search"
        >検索<input
          v-model="filters.q"
          maxlength="200"
          placeholder="単語・読み方・意味"
          :disabled="busy" /></label
      ><button :disabled="busy">検索</button
      ><button type="button" :disabled="busy" @click="reset">リセット</button>
    </form>
    <div class="word-library-tools">
      <label><input v-model="hideReading" type="checkbox" />読み方を隠す</label
      ><label><input v-model="hideMeaning" type="checkbox" />意味を隠す</label
      ><select v-model="filters.sort" aria-label="並び順" :disabled="busy" @change="load(1)">
        <option value="recent">更新が新しい順</option>
        <option value="word">単語順</option>
        <option value="reading">読み方順</option>
        <option value="random">ランダム</option></select
      ><button :disabled="busy || loading" @click="shuffle">シャッフル</button>
      <select v-model="filters.mastery" aria-label="学習状態" :disabled="busy" @change="load(1)">
        <option value="all">すべて</option>
        <option value="unlearned">未暗記</option>
        <option value="learned">暗記済み</option>
      </select>
      <button :disabled="busy || loading || !data.total" @click="resetMastery">
        暗記チェックを解除
      </button>
    </div>
    <p v-if="error" class="library-error" role="alert">{{ error }}</p>
    <p v-if="message" class="library-message" role="status">{{ message }}</p>
    <section class="word-library-list" :aria-busy="loading">
      <p v-if="loading">読み込み中…</p>
      <p v-else-if="!data.items.length">
        条件に一致する単語はありません。PDFノートの単語タブから登録できます。
      </p>
      <table v-else>
        <colgroup>
          <col class="select-col" />
          <col class="term-col" />
          <col class="reading-col" />
          <col class="meaning-col" />
          <col class="source-col" />
        </colgroup>
        <thead>
          <tr>
            <th>覚えた</th>
            <th>単語</th>
            <th>読み方</th>
            <th>意味</th>
            <th>出典・編集</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in data.items" :key="item.id" :class="{ mastered: item.mastered }">
            <td>
              <input
                type="checkbox"
                :checked="item.mastered"
                @change="setMastery(item, $event.target.checked)"
                :aria-label="item.word + 'を暗記済みにする'"
                :disabled="busy"
              />
            </td>
            <td>
              <strong>{{ item.word }}</strong>
            </td>
            <td>
              <button
                v-if="hideReading"
                class="reveal"
                :aria-label="item.word + 'の読み方を表示'"
                @click="reveal(item.id, 'reading')"
              >
                {{ revealed.has(item.id + ':reading') ? item.reading || '—' : '表示' }}</button
              ><template v-else>{{ item.reading || '—' }}</template>
            </td>
            <td>
              <button
                v-if="hideMeaning"
                class="reveal"
                :aria-label="item.word + 'の意味を表示'"
                @click="reveal(item.id, 'meaning')"
              >
                {{ revealed.has(item.id + ':meaning') ? item.meaning : '表示' }}</button
              ><template v-else>{{ item.meaning }}</template>
            </td>
            <td>
              <button class="edit-word" :disabled="busy" @click="openEdit(item)">編集</button>
              <details>
                <summary>{{ item.sources.length }}出典</summary>
                <div v-for="source in item.sources" :key="source.word_id" class="word-source">
                  <RouterLink
                    :to="{
                      path: '/learning/pdf-notes/' + source.note_id,
                      query: { page: source.page },
                    }"
                    >{{ source.pdf_title }} · p.{{ source.page }}</RouterLink
                  ><small
                    >{{ source.roadmap_title || '目標未設定' }} /
                    {{ source.milestone_title || '未設定' }}</small
                  ><small v-if="!item.matching_source_ids.includes(source.word_id)"
                    >現在のフィルター範囲外</small
                  >
                </div>
              </details>
            </td>
          </tr>
        </tbody>
      </table>
    </section>
    <nav class="word-pagination" aria-label="単語帳のページ">
      <button :disabled="loading || busy || data.page <= 1" @click="load(data.page - 1)">
        前へ</button
      ><span>{{ data.page }} / {{ data.pages }} · {{ data.total }}単語</span
      ><button :disabled="loading || busy || data.page >= data.pages" @click="load(data.page + 1)">
        次へ
      </button>
    </nav>
    <WordSourcesModal
      v-if="modal"
      :mode="modal.mode"
      @delete="modal.mode = 'delete'"
      @back="modal.mode = 'edit'"
      :sources="modal.sources"
      :word="modal.word"
      :busy="busy"
      :error="mutationError"
      @close="modal = null"
      @confirm="mutate"
    />
  </main>
</template>
<script setup>
import { onBeforeUnmount, reactive, ref, watch } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { wordLibraryApi } from '../utils/wordLibraryApi'
import WordSourcesModal from '../components/learning/WordSourcesModal.vue'
const filters = reactive({
  roadmap_id: '',
  milestone_id: '',
  note_id: '',
  pdf_page: '',
  q: '',
  sort: 'recent',
  seed: '',
  mastery: 'all',
})
const data = ref({
  items: [],
  total: 0,
  page: 1,
  pages: 1,
  source_count: 0,
  facets: { roadmaps: [], milestones: [], pdfs: [], pages: [] },
})
const loading = ref(false),
  busy = ref(false),
  error = ref(''),
  message = ref(''),
  modal = ref(null),
  mutationError = ref(''),
  hideReading = ref(false),
  hideMeaning = ref(false),
  revealed = ref(new Set())
let controller,
  revision = 0
async function load(page = 1) {
  controller?.abort()
  controller = new AbortController()
  const version = ++revision
  loading.value = true
  error.value = ''
  revealed.value = new Set()
  try {
    const result = await wordLibraryApi.list({ ...filters, page }, controller.signal)
    if (version === revision) data.value = result
  } catch (e) {
    if (version === revision && e.code !== 'ERR_CANCELED')
      error.value = e.response?.data?.message || '単語を読み込めませんでした。'
  } finally {
    if (version === revision) loading.value = false
  }
}
function changeFilter(key) {
  if (key === 'roadmap_id') filters.milestone_id = ''
  if (key !== 'note_id') filters.note_id = ''
  filters.pdf_page = ''
  load(1)
}
function reset() {
  Object.assign(filters, {
    roadmap_id: '',
    milestone_id: '',
    note_id: '',
    pdf_page: '',
    q: '',
    sort: 'recent',
    seed: '',
    mastery: 'all',
  })
  message.value = ''
  load(1)
}
function reveal(id, field) {
  const next = new Set(revealed.value),
    key = id + ':' + field
  next.has(key) ? next.delete(key) : next.add(key)
  revealed.value = next
}
watch([hideReading, hideMeaning], () => {
  revealed.value = new Set()
})
function openEdit(item) {
  mutationError.value = ''
  modal.value = { mode: 'edit', word: item, sources: item.sources }
}
function shuffle() {
  filters.sort = 'random'
  filters.seed = crypto.randomUUID()
  load(1)
}
async function resetMastery() {
  if (busy.value || loading.value) return
  if (
    !window.confirm(
      '現在のフィルターに一致する単語の暗記チェックを、全ページで解除します。同じ単語の他の出典にも適用します。単語は削除されません。続けますか？',
    )
  )
    return
  const scope = { ...filters }
  busy.value = true
  error.value = ''
  try {
    const result = await wordLibraryApi.resetMastery(scope)
    message.value = result.count + '単語の暗記チェックを解除しました。'
    await load(data.value.page)
  } catch (e) {
    error.value = e.response?.data?.message || '暗記チェックを解除できませんでした。'
  } finally {
    busy.value = false
  }
}
async function setMastery(item, mastered) {
  if (busy.value) return
  busy.value = true
  error.value = ''
  try {
    await wordLibraryApi.mastery(
      item.sources.map((source) => source.word_id),
      mastered,
    )
    item.mastered = mastered
    if (filters.mastery !== 'all') await load(data.value.page)
  } catch (e) {
    await load(data.value.page)
    error.value = e.response?.data?.message || '学習状態を保存できませんでした。'
  } finally {
    busy.value = false
  }
}
async function mutate(input) {
  if (busy.value) return
  busy.value = true
  mutationError.value = ''
  try {
    const result =
      modal.value.mode === 'edit'
        ? await wordLibraryApi.update(input)
        : await wordLibraryApi.remove(input.ids)
    message.value =
      result.count +
      (modal.value.mode === 'edit' ? '件の出典を更新しました。' : '件の出典を削除しました。')
    modal.value = null
    await load(data.value.page)
  } catch (e) {
    mutationError.value =
      e.response?.data?.message || '処理できませんでした。変更は適用されていません。'
  } finally {
    busy.value = false
  }
}
onBeforeRouteLeave(() => !busy.value)
onBeforeUnmount(() => {
  revision++
  controller?.abort()
})
load()
</script>
<style scoped>
.word-library {
  max-width: 1460px;
  margin: 0 auto;
  padding: 24px;
  color: #26364c;
  font-size: 14px;
}
.word-library header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 24px;
}
.word-library h1 {
  margin: 0;
  font-size: 28px;
}
.word-library header p,
.word-library header > span {
  color: #708199;
  font-size: 13px;
}
.word-filters {
  display: flex;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 12px;
  padding: 18px;
  background: #f5f8fc;
  border: 1px solid #dce4ee;
  border-radius: 12px;
}
.word-filters label {
  display: grid;
  gap: 6px;
  flex: 1 1 160px;
  min-width: 0;
  font-size: 12px;
}
.word-filters .word-search {
  flex: 2 1 250px;
}
.word-library input:not([type='checkbox']),
.word-library select {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  border: 1px solid #cdd8e8;
  border-radius: 7px;
  padding: 9px;
  background: white;
  font: inherit;
  color: #354963;
}
.word-library button {
  border: 1px solid #d9e1ed;
  border-radius: 7px;
  padding: 8px 12px;
  background: white;
  color: #315cbb;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.word-library button:disabled {
  opacity: 0.5;
  cursor: default;
}
.word-library input[type='checkbox'] {
  accent-color: #315cbb;
}
.word-library-tools {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  margin: 18px 0;
}
.word-library-tools label {
  font-size: 13px;
}
.word-library-tools select {
  width: auto;
  margin-left: auto;
}
.word-library .danger-text {
  color: #b42335;
}
.word-library-list {
  border: 1px solid #dce4ee;
  border-radius: 12px;
  background: white;
  padding: 16px;
}
.word-library-list > p {
  color: #708199;
  padding: 24px;
  text-align: center;
}
.word-library table {
  width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
  font-size: 13px;
  line-height: 1.65;
}
.select-col {
  width: 48px;
}
.term-col {
  width: calc(22% - 12px);
}
.reading-col {
  width: calc(28% - 12px);
}
.meaning-col {
  width: calc(28% - 12px);
}
.source-col {
  width: calc(22% - 12px);
}
th {
  text-align: left;
  color: #708199;
  font-size: 12px;
  font-weight: 500;
  padding: 8px 6px;
  border-bottom: 1px solid #dce4ee;
}
td {
  padding: 14px 6px;
  vertical-align: top;
  overflow-wrap: anywhere;
  border-bottom: 1px solid #e9edf4;
}
th:first-child,
td:first-child {
  padding-left: 0;
}
th:last-child,
td:last-child {
  padding-right: 0;
}
.word-library .reveal {
  padding: 3px 7px;
  max-width: 100%;
  white-space: normal;
  text-align: left;
  overflow-wrap: anywhere;
}
.word-library .edit-word {
  padding: 2px 7px;
  margin-bottom: 6px;
}
.word-source {
  padding-top: 9px;
  font-size: 12px;
}
.word-source a {
  color: #315cbb;
  text-decoration: none;
}
.word-source small {
  display: block;
  color: #708199;
  font-size: 11px;
}
summary {
  cursor: pointer;
  color: #708199;
  font-size: 12px;
}
.library-error {
  color: #b42335;
}
.library-message {
  color: #238268;
}
.word-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  margin: 20px 0;
}
.word-pagination span {
  font-size: 12px;
  color: #708199;
}
@media (max-width: 700px) {
  .word-library {
    padding: 14px;
  }
  .word-library header {
    align-items: flex-start;
    flex-direction: column;
    gap: 0;
  }
  .word-library-list {
    padding: 10px;
  }
  .word-library table {
    font-size: 12px;
  }
  td {
    padding: 12px 4px;
  }
  .word-library-tools {
    gap: 10px;
  }
  .word-library-tools select {
    margin-left: 0;
  }
  .word-library button {
    padding: 7px 8px;
  }
}
</style>
<style scoped>
tr.mastered {
  background: #f2f8f5;
}
tr.mastered strong {
  color: #238268;
}
</style>
