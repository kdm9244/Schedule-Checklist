<template>
  <div class="learning-page learning pdf-edit-page">
    <RouterLink :to="backLink" class="learning-back">‹ 学習ノートに戻る</RouterLink>
    <header class="learning-header">
      <div>
        <h1>PDFノートを編集</h1>
        <p>タイトルや関連先を変更できます。本文とPDFは保持します。</p>
      </div>
    </header>
    <p v-if="error" class="learning-error" role="alert">{{ error }}</p>
    <p v-if="loading">読み込み中…</p>
    <div v-else-if="note" class="pdf-edit-layout">
      <PdfDocumentPane :src="pdfNoteApi.fileUrl(note.note_id)" :model-value="note.last_page" />
      <form class="pdf-edit-form ui-surface" @submit.prevent="save">
        <label>タイトル<input v-model="title" maxlength="200" required :disabled="busy" /></label
        ><PdfConnectionsForm v-model="connections" :disabled="busy" required />
        <p>移動先の小さな目標を選ぶと、PDFとすべてのノートが一緒に移動します。</p>
        <footer>
          <RouterLink :to="backLink">キャンセル</RouterLink
          ><button class="primary" :disabled="busy || !connections.milestone_id">
            {{ busy ? '保存中…' : '変更を保存' }}
          </button>
        </footer>
      </form>
    </div>
  </div>
</template>
<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router'
import { useLearning } from '../composables/useLearning'
import { pdfNoteApi, pdfNoteBackLink } from '../utils/pdfNoteApi'
import PdfConnectionsForm from '../components/learning/PdfConnectionsForm.vue'
import PdfDocumentPane from '../components/learning/PdfDocumentPane.vue'
const route = useRoute(),
  router = useRouter(),
  { load } = useLearning(),
  note = ref(null),
  title = ref(''),
  connections = ref({ roadmap_id: '', milestone_id: '', task_id: '' }),
  loading = ref(true),
  busy = ref(false),
  error = ref('')
let baseline = '',
  saved = false
const backLink = computed(() =>
  note.value ? '/learning/pdf-notes/' + note.value.note_id : '/learning/roadmaps',
)
const serialized = () => JSON.stringify({ title: title.value, ...connections.value })
onMounted(async () => {
  try {
    await load()
    const data = await pdfNoteApi.get(route.params.id)
    note.value = data.note
    title.value = data.note.title
    connections.value = {
      roadmap_id: data.note.roadmap_id || '',
      milestone_id: data.note.milestone_id || '',
      task_id: data.note.task_id || '',
    }
    baseline = serialized()
  } catch (e) {
    error.value = e.response?.data?.message || e.message
  } finally {
    loading.value = false
  }
})
async function save() {
  if (busy.value) return
  busy.value = true
  error.value = ''
  try {
    const updated = await pdfNoteApi.update(note.value.note_id, {
      title: title.value,
      ...connections.value,
    })
    saved = true
    await router.push(pdfNoteBackLink(updated))
  } catch (e) {
    error.value = e.response?.data?.message || e.message
  } finally {
    busy.value = false
  }
}
onBeforeRouteLeave(
  () =>
    !note.value || loading.value || saved || serialized() === baseline || confirm('変更がまだ保存されていません。移動しますか？'),
)
</script>
<style scoped>
.pdf-edit-page {
  max-width: 1400px;
}
.pdf-edit-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(300px, 0.9fr);
  gap: 24px;
  min-height: 520px;
  height: calc(100dvh - 230px);
}
.pdf-edit-form {
  padding: 28px;
  border-radius: 14px;
  display: flex;
  flex-direction: column;
  gap: 22px;
  overflow: auto;
}
.pdf-edit-form > label {
  display: grid;
  gap: 8px;
  font-size: 13px;
}
.pdf-edit-form input {
  font: inherit;
  padding: 12px;
  border: 1px solid #d5dfed;
  border-radius: 9px;
}
.pdf-edit-form p {
  font-size: 12px;
  line-height: 1.8;
  color: #8a99ad;
}
.pdf-edit-form footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 14px;
  margin-top: auto;
}
@media (max-width: 850px) {
  .pdf-edit-layout {
    display: flex;
    flex-direction: column;
    height: auto;
  }
  .pdf-edit-layout > :first-child {
    height: 42vh;
    flex-shrink: 0;
  }
  .pdf-edit-form {
    padding: 22px;
  }
}
</style>
