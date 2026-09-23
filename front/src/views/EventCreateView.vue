<template>
  <div class="event-create-page">
    <header class="create-header">
      <button class="back-button" @click="goBack">‹</button>
      <div>
        <span class="page-label">NEW EVENT</span>
        <h1>予定を追加</h1>
      </div>
    </header>

    <form class="event-form-shell ui-surface" @submit.prevent="submitForm">
      <fieldset class="event-form-panel" :disabled="submitting || !!pendingPayload">
        <div class="panel-heading">
          <span class="step-number">01</span>
          <div>
            <h2>予定の情報</h2>
          </div>
        </div>

        <div class="form-grid">
          <label class="field full">
            <span>予定名 <b>必須</b></span>
            <input v-model="form.title" maxlength="100" placeholder="例：DB研修" />
            <small v-if="errors.title">{{ errors.title }}</small>
          </label>

          <label class="field">
            <span>日付 <b>必須</b></span>
            <input v-model="form.date" type="date" />
            <small v-if="errors.date">{{ errors.date }}</small>
          </label>

          <label class="all-day-toggle">
            <input v-model="form.allDay" type="checkbox" />
            <span>終日の予定</span>
          </label>

          <label class="field">
            <span>開始時間</span>
            <input v-model="form.startTime" type="time" :disabled="form.allDay" />
          </label>

          <label class="field">
            <span>終了時間</span>
            <input v-model="form.endTime" type="time" :disabled="form.allDay" />
            <small v-if="errors.time">{{ errors.time }}</small>
          </label>

          <label class="field full">
            <span>場所</span>
            <input v-model="form.location" maxlength="150" placeholder="例：第1研修室" />
          </label>

          <label class="field full">
            <span>説明</span>
            <textarea v-model="form.description" maxlength="500" placeholder="予定の補足を入力..."></textarea>
            <em>{{ form.description.length }}/500</em>
          </label>
        </div>
      </fieldset>

      <aside class="checklist-panel">
        <div class="panel-heading">
          <span class="step-number">02</span>
          <div>
            <h2>準備チェックリスト</h2>
          </div>
        </div>

        <fieldset class="checklist-input-row" :disabled="submitting || !!pendingPayload">
          <input
            v-model="checklistInput"
            maxlength="200"
            placeholder="準備するものを入力..."
            @keydown.enter.prevent="addChecklist"
          />
          <button type="button" :disabled="!checklistInput.trim()" @click="addChecklist">＋ 追加</button>
        </fieldset>

        <div v-if="form.checklists.length" class="draft-list">
          <div v-for="(item, index) in form.checklists" :key="item.id" class="draft-item" :draggable="!submitting && !pendingPayload" @dragstart="dragIndex = index" @dragover.prevent @drop.prevent="moveChecklist(dragIndex, index)">
            <span class="drag-handle" title="ドラッグで並べ替え">⋮⋮</span>
            <span>{{ item.title }}</span>
            <button type="button" :disabled="index === 0 || submitting || !!pendingPayload" aria-label="上へ移動" @click="moveChecklist(index, index - 1)">↑</button><button type="button" :disabled="index === form.checklists.length - 1 || submitting || !!pendingPayload" aria-label="下へ移動" @click="moveChecklist(index, index + 1)">↓</button><button type="button" :disabled="submitting || !!pendingPayload" title="削除" @click="removeChecklist(index)">×</button>
          </div>
        </div>

        <div v-else class="checklist-empty">
          <span>✓</span>
          <strong>準備項目はまだありません</strong>
        </div>

        <div class="form-footer">
          <p v-if="submitMessage" class="submit-message" role="status">{{ submitMessage }}</p>
          <div class="form-actions">
            <button type="button" class="cancel-button" :disabled="submitting" @click="goBack">キャンセル</button>
            <button type="submit" class="primary-button" :disabled="submitting">{{ submitting ? '登録中...' : pendingPayload ? '同じ内容で再試行' : '予定を登録' }}</button>
          </div>
        </div>
      </aside>
    </form>
  </div>
</template>

<script setup>
import { reactive, ref, onMounted, onBeforeUnmount } from 'vue'
import axios from 'axios'
import { API_ORIGIN } from '../utils/http'
import { validDate } from '../utils/calendar'
import { useRoute, useRouter, onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router'

const route = useRoute()
const router = useRouter()
const checklistInput = ref('')
const submitMessage = ref('')
let checklistSequence = 0

const form = reactive({
  title: '',
  date: validDate(route.query.date) ? route.query.date : formatDate(new Date()),
  allDay: false,
  startTime: '09:00',
  endTime: '10:00',
  location: '',
  description: '',
  checklists: []
})

const errors = reactive({
  title: '',
  date: '',
  time: ''
})

function addChecklist() {
  const title = checklistInput.value.trim()
  if (!title) return

  form.checklists.push({
    id: ++checklistSequence,
    title
  })
  checklistInput.value = ''
}

function removeChecklist(index) {
  form.checklists.splice(index, 1)
}

function validate() {
  errors.title = form.title.trim() ? '' : '予定名を入力してください。'
  errors.date = validDate(form.date) ? '' : '日付を選択してください。'
  errors.time = ''

  if (!form.allDay && (!form.startTime || !form.endTime || form.startTime >= form.endTime)) {
    errors.time = '終了時間は開始時間より後に設定してください。'
  }

  return !errors.title && !errors.date && !errors.time
}

const submitting = ref(false)
const pendingPayload = ref(null)
const dragIndex = ref(null)
const initialForm = JSON.stringify(form)
let saved = false
function moveChecklist(from, to) {
  if (submitting.value || pendingPayload.value || from === null || to < 0 || to >= form.checklists.length) return
  const [item] = form.checklists.splice(from, 1)
  form.checklists.splice(to, 0, item)
  dragIndex.value = null
}
function canLeave() {
  if (submitting.value) return false
  if (saved) return true
  if (pendingPayload.value) return window.confirm('Google Calendar に登録済みの可能性があります。再試行して保存を完了することをおすすめします。画面を離れますか？')
  return (JSON.stringify(form) === initialForm && !checklistInput.value.trim()) || window.confirm('未保存の内容を破棄しますか？')
}
onBeforeRouteLeave(canLeave)
onBeforeRouteUpdate(canLeave)
function beforeUnload(event) {
  if (!saved && (pendingPayload.value || JSON.stringify(form) !== initialForm || checklistInput.value.trim())) {
    event.preventDefault()
    event.returnValue = ''
  }
}
onMounted(() => window.addEventListener('beforeunload', beforeUnload))
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))
async function submitForm() {
  if (submitting.value) return
  if (!pendingPayload.value) {
    if (!validate()) return
    if (checklistInput.value.trim()) addChecklist()
    pendingPayload.value = JSON.parse(JSON.stringify({
      ...form, requestId: crypto.randomUUID(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
    }))
  }
  submitting.value = true
  submitMessage.value = ''
  try {
    const { data } = await axios.post(API_ORIGIN + '/api/calendar/events', pendingPayload.value, { withCredentials: true })
    saved = true
    submitting.value = false
    await router.push({ path: '/today', query: { date: data.date, event: data.calendarId + ':' + data.googleEventId } })
  } catch (error) {
    if (error.response?.status === 400 || error.response?.status === 401) pendingPayload.value = null
    submitMessage.value = error.response?.data?.message || '登録を完了できませんでした。同じ内容で再試行してください（重複登録を防ぎます）。'
  } finally { submitting.value = false }
}
function goBack() {
  router.push({ path: '/calendar', query: { date: form.date } })
}

function formatDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
</script>

<style scoped>
fieldset { margin: 0; border: 0; min-width: 0; padding: 0; }
.draft-item { grid-template-columns: 18px minmax(0,1fr) 24px 24px 24px !important; }
.drag-handle { cursor: grab; }
button:disabled { opacity: .45; cursor: default; }
.event-create-page { width: 100%; height: 100%; min-height: 0; display: flex; flex-direction: column; color: #243247; }
.create-header { min-height: 72px; display: flex; align-items: center; gap: 15px; margin-bottom: 14px; }
.back-button { width: 38px; height: 38px; border: 1px solid #d2dae6; border-radius: 9px; background: #fff; color: #526176; font-size: 22px; cursor: pointer; }
.page-label { display: block; margin-bottom: 3px; color: #667892; font-size: 9px; font-weight: 800; letter-spacing: 1.7px; }
.create-header h1 { margin: 0; font-size: 23px; letter-spacing: -.6px; }
.create-header p { margin: 4px 0 0; color: #7b8798; font-size: 11px; }
.event-form-shell { flex: 1; min-height: 0; display: grid; grid-template-columns: minmax(0, 1.45fr) minmax(320px, .8fr); overflow: hidden; }
.event-form-panel, .checklist-panel { min-width: 0; min-height: 0; padding: 28px; overflow: auto; }
.event-form-panel { border-right: 1px solid #dfe5ed; }
.checklist-panel { display: flex; flex-direction: column; }
.panel-heading { display: flex; align-items: flex-start; gap: 11px; margin-bottom: 24px; }
.step-number { min-width: 30px; height: 30px; display: grid; place-items: center; border-radius: 8px; background: #273c5c; color: #fff; font-size: 10px; font-weight: 800; }
.panel-heading h2 { margin: 1px 0 4px; font-size: 16px; }
.panel-heading p { margin: 0; color: #8893a3; font-size: 10px; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px 16px; }
.field { position: relative; display: flex; flex-direction: column; gap: 7px; }
.field.full { grid-column: 1 / -1; }
.field > span, .all-day-toggle span { color: #526176; font-size: 11px; font-weight: 700; }
.field b { margin-left: 4px; color: #c45151; font-size: 8px; }
.field input, .field textarea, .checklist-input-row input { width: 100%; border: 1px solid #d5dce6; border-radius: 9px; background: #fff; color: #2f3c50; outline: none; }
.field input { height: 40px; padding: 0 11px; }
.field textarea { height: 88px; padding: 10px 11px; resize: none; font-family: inherit; }
.field input:focus, .field textarea:focus, .checklist-input-row input:focus { border-color: #315cbb; box-shadow: 0 0 0 3px rgba(49,92,187,.1); }
.field input:disabled { background: #f1f3f6; color: #a1a9b5; }
.field small { color: #c45151; font-size: 9px; }
.field em { position: absolute; right: 3px; bottom: -15px; color: #a0a9b5; font-size: 8px; font-style: normal; }
.all-day-toggle { align-self: end; height: 40px; display: flex; align-items: center; gap: 8px; padding: 0 11px; border-radius: 9px; background: #eef1f5; cursor: pointer; }
.all-day-toggle input { width: 15px; height: 15px; accent-color: #315cbb; }
.checklist-input-row { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 7px; }
.checklist-input-row input { height: 40px; padding: 0 10px; }
.checklist-input-row button { padding: 0 12px; border: none; border-radius: 8px; background: #315cbb; color: #fff; font-size: 10px; font-weight: 700; cursor: pointer; }
.checklist-input-row button:disabled { opacity: .45; cursor: default; }
.draft-list { display: flex; flex-direction: column; gap: 6px; margin-top: 15px; }
.draft-item { min-height: 38px; display: grid; grid-template-columns: 18px minmax(0,1fr) 24px; align-items: center; gap: 7px; padding: 4px 7px; border: 1px solid #e0e5ec; border-radius: 8px; color: #526176; font-size: 11px; }
.drag-handle { color: #a4adba; }
.draft-item button { border: none; background: transparent; color: #a4adba; font-size: 17px; cursor: pointer; }
.draft-item button:hover { color: #c45151; }
.checklist-empty { flex: 1; min-height: 160px; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #929dac; text-align: center; }
.checklist-empty > span { width: 34px; height: 34px; display: grid; place-items: center; margin-bottom: 10px; border-radius: 50%; background: #edf5f2; color: #16856b; }
.checklist-empty strong { color: #657286; font-size: 11px; }
.checklist-empty p { margin: 5px 0 0; font-size: 9px; }
.form-footer { margin-top: auto; padding-top: 18px; border-top: 1px solid #e5e9ef; }
.submit-message { margin: 0 0 10px; color: #126d58; font-size: 9px; line-height: 1.5; }
.form-actions { display: grid; grid-template-columns: 1fr 1.4fr; gap: 8px; }
.form-actions button { height: 40px; border-radius: 9px; font-size: 11px; font-weight: 700; cursor: pointer; }
.cancel-button { border: 1px solid #d3dae5; background: #fff; color: #68768a; }
.primary-button { border: none; background: #273c5c; color: #fff; }
@media (max-width: 900px) {
  .event-create-page { height: auto; }
  .event-form-shell { grid-template-columns: 1fr; overflow: visible; }
  .event-form-panel { border-right: none; border-bottom: 1px solid #dfe5ed; }
  .checklist-panel { min-height: 430px; }
}
@media (max-width: 600px) {
  .form-grid { grid-template-columns: 1fr; }
  .field.full { grid-column: auto; }
  .event-form-panel, .checklist-panel { padding: 21px 18px; }
}
</style>
