<template>
  <div class="today-page">

    <!-- ================================
         Header
    ================================= -->
    <header class="page-header">

      <div class="date-navigation">

        <button
          class="nav-button"
          @click="moveDate(-1)"
          title="前の日"
        >
          ‹
        </button>

        <div class="date-picker-wrap">

          <button
            class="date-display"
            @click="openDatePicker"
          >
            <span class="date-main">
              {{ formattedDate }}
            </span>

            <span class="date-arrow">
              ▾
            </span>
          </button>

          <input
            ref="dateInput"
            v-model="dateInputValue"
            class="hidden-date-picker"
            type="date"
            @change="selectDate"
          />

        </div>

        <button
          class="nav-button"
          @click="moveDate(1)"
          title="次の日"
        >
          ›
        </button>

      </div>


      <div class="header-actions">

        <button
          v-if="!isToday"
          class="today-button"
          @click="goToday"
        >
          今日
        </button>

        <button
          class="sync-button"
          :disabled="syncing"
          @click="syncCalendar"
        >
          <span
            class="sync-icon"
            :class="{ spinning: syncing }"
          >
            ↻
          </span>

          同期
        </button>

      </div>

    </header>


    <!-- ================================
         Main
    ================================= -->
    <main class="planner workspace-grid">

      <!-- 일정 -->
      <section class="schedule-section">

        <div class="section-title-row">

          <div>
            <span class="section-label">
              SCHEDULE
            </span>

            <h2>
              {{ dayLabel }}の予定
            </h2>
          </div>

          <span class="section-count">
            {{ schedules.length }}件
          </span>

        </div>

        <div class="section-divider"></div>


        <!-- 로딩 -->
        <div
          v-if="loading"
          class="schedule-empty"
        >
          <div>
            <p class="empty-title">
              予定を読み込んでいます...
            </p>
          </div>
        </div>


        <div v-else-if="scheduleError" class="schedule-empty" role="alert">{{ scheduleError }}<button @click="syncCalendar">再試行</button></div>
        <!-- 일정 없음 -->
        <div
          v-else-if="schedules.length === 0"
          class="schedule-empty"
        >
          <div class="empty-clock">
            ○
          </div>

          <div>
            <p class="empty-title">
              この日の予定はありません
            </p>

            <p class="empty-description">
              Google Calendar の予定がここに表示されます。
            </p>
          </div>
        </div>


        <div v-else class="schedule-content">
          <div class="schedule-list unified-schedule-list">
            <button
              v-for="schedule in orderedSchedules"
              :key="schedule.key"
              :class="['schedule-row', { 'schedule-row-selected': checklistTab === 'event' && selectedSchedule?.key === schedule.key }]"
              :style="{ '--event-color': schedule.calendarColor }"
              @click="openFocus(schedule)"
            >
              <div :class="['schedule-time', { 'all-day-time': schedule.allDay }]">
                <strong>{{ schedule.allDay ? '終日' : schedule.startTime }}</strong>
                <span v-if="!schedule.allDay && schedule.endTime">{{ schedule.endTime }}</span>
              </div>

              <div class="schedule-line">
                <span class="schedule-dot" :style="{ backgroundColor:schedule.calendarColor }"></span>
                <span class="vertical-line"></span>
              </div>

              <div class="schedule-body">
                <div class="schedule-heading">
                  <div>
                    <h3>{{ schedule.title }}</h3>
                    <p v-if="schedule.calendarName || schedule.location">
                      {{ [schedule.calendarName, schedule.location].filter(Boolean).join(' · ') }}
                    </p>
                  </div>
                  <span class="schedule-progress-count">
                    {{ scheduleProgressLabel(schedule) }}
                  </span>
                </div>
              </div>
            </button>
          </div>
        </div>

      </section>

      <section class="center-column">
      <section v-if="!detailEvent" class="overview-section">
        <div class="section-title-row overview-title-row">
          <div><span class="section-label">CHECKLIST OVERVIEW</span><h2>{{ dayLabel }}の全チェックリスト</h2></div>
          <span class="checklist-total">{{ overallCompleted }}/{{ overallItems.length }}</span>
        </div>
        <div class="section-divider"></div>
        <div class="overview-summary">
          <span>通常のタスクを先に、予定の準備をその下に表示します</span>
          <strong v-if="overallItems.length && overallCompleted === overallItems.length">✓ すべて完了</strong>
        </div>
        <div class="progress-track" aria-hidden="true"><span :style="{ width: `${overallProgress}%` }"></span></div>

        <div v-if="checklistLoading" class="small-empty"><span>チェックリストを読み込んでいます...</span></div>
        <div v-else-if="!checklistError && overallItems.length === 0" class="small-empty overview-empty">
          <strong>まだ項目がありません</strong><span>{{ dayLabel }}やることを追加しましょう。</span>
        </div>
        <div v-else class="overview-groups">
          <section v-for="group in overviewGroups" :key="group.key" :class="['overview-group', { expanded:group.kind === 'general' || expandedGroupKey === group.key }]">
            <div v-if="group.kind === 'general'" class="overview-group-heading">
              <div><span>GENERAL</span><strong>{{ group.title }}</strong></div>
              <small>{{ getCompletedCount(group.items) }}/{{ group.items.length }}</small>
            </div>
            <div v-else class="overview-group-heading event-group-heading">
              <button class="overview-toggle" type="button" :aria-expanded="expandedGroupKey === group.key" @click="toggleOverviewGroup(group.key)">
                <span class="accordion-arrow">{{ expandedGroupKey === group.key ? '⌄' : '›' }}</span>
                <span class="event-time-label">{{ group.schedule.allDay ? '終日' : group.schedule.startTime }}</span>
                <strong>{{ group.title }}</strong>
                <small>{{ getCompletedCount(group.items) }}/{{ group.items.length }}</small>
              </button>
              <button class="overview-detail-button" type="button" @click="openFocus(group.schedule)">詳細</button>
            </div>
            <div v-if="group.kind === 'general' && group.items.length === 0" class="overview-group-empty">通常のタスクはまだありません</div>
            <div v-else-if="group.kind === 'general' || expandedGroupKey === group.key" class="todo-list overview-list">
              <label v-for="(item,index) in group.items" :key="item.id" class="todo-row"
                :draggable="!reordering" @dragstart="dragIndex=index" @dragover.prevent @drop.prevent="moveChecklist(dragIndex,index,group.items)">
                <input :checked="item.completed" :disabled="item.pending" type="checkbox" @change="updateChecklistStatus(item,$event.target.checked)">
                <span :class="{completed:item.completed}">{{ item.title }}</span>
                <button type="button" class="order-button" :disabled="index===0 || reordering" aria-label="上へ移動" @click.prevent="moveChecklist(index,index-1,group.items)">↑</button>
                <button type="button" class="order-button" :disabled="index===group.items.length-1 || reordering" aria-label="下へ移動" @click.prevent="moveChecklist(index,index+1,group.items)">↓</button>
                <button type="button" class="delete-checklist-button" :disabled="deletingChecklistId===item.id" title="削除" @click.stop="deleteChecklist(item,group.items)">×</button>
              </label>
            </div>
          </section>
        </div>

        <div class="checklist-editor inline-editor overview-editor">
          <input v-model="newChecklistTitle" class="checklist-input" type="text" maxlength="200"
            placeholder="通常のチェックリストを追加..." @keydown.enter.prevent="addChecklist"
            :disabled="savingChecklist || reordering || checklistLoading || !!checklistError">
          <button class="checklist-save-button" :disabled="savingChecklist || reordering || checklistLoading || !!checklistError || !newChecklistTitle.trim()" @click="addChecklist">
            {{ savingChecklist ? '追加中...' : '＋ 追加' }}
          </button>
          <p v-if="checklistError" class="checklist-error">{{ checklistError }}</p>
        </div>
      </section>

      <EventWorkspace v-else class="embedded-detail" :key="detailEvent.key" :event="detailEvent"
        :show-checklist="false" @close="closeFocus" @changed="handleEventChange" />

      </section>


      <!-- 오른쪽 -->
      <aside class="checklist-column">

        <!-- 일반 체크리스트 -->
        <section v-if="detailEvent" class="todo-section">

          <div class="section-title-row checklist-title-row">

            <div>
              <span class="section-label">
                CHECKLIST
              </span>

              <h2>{{ checklistTitle }}</h2>
            </div>

            <span class="checklist-total">
              {{ displayCompletedCount }}/{{ displayChecklists.length }}
            </span>

          </div>

          <div class="section-divider"></div>

          <div class="selected-event-summary">
            <template v-if="checklistTab === 'event' && selectedSchedule">
              <div>
                <span>{{ selectedSchedule.allDay ? '終日' : `${selectedSchedule.startTime}–${selectedSchedule.endTime}` }}</span>
                <span v-if="selectedSchedule.location"> · {{ selectedSchedule.location }}</span>
              </div>
              <strong v-if="displayChecklists.length && displayCompletedCount === displayChecklists.length">✓ すべて完了</strong>
              <span v-else>準備を確認しましょう</span>
            </template>
            <template v-else>
              <div>{{ dayLabel }}やること</div>
              <strong v-if="displayChecklists.length && displayCompletedCount === displayChecklists.length">✓ すべて完了</strong>
              <span v-else>{{ dayLabel }}のタスクを確認しましょう</span>
            </template>
          </div>

          <div class="progress-track" aria-hidden="true">
            <span :style="{ width: `${displayProgress}%` }"></span>
          </div>

          <div v-if="!checklistLoading && !checklistError && displayChecklists.length === 0" class="small-empty">
            <strong>まだ項目がありません</strong>
            <span>{{ checklistTab === 'event' ? 'この予定に必要なものを追加しましょう。' : '今日やることを追加しましょう。' }}</span>
          </div>

          <div v-else class="todo-list">
            <label v-for="(item,index) in displayChecklists" :key="item.id" class="todo-row"
              :draggable="!reordering" @dragstart="dragIndex=index" @dragover.prevent @drop.prevent="moveChecklist(dragIndex,index)">
              <input :checked="item.completed" :disabled="item.pending" type="checkbox" @change="updateChecklistStatus(item,$event.target.checked)">
              <span :class="{completed:item.completed}">{{ item.title }}</span>
              <button type="button" class="order-button" :disabled="index===0 || reordering" aria-label="上へ移動" @click.prevent="moveChecklist(index,index-1)">↑</button>
              <button type="button" class="order-button" :disabled="index===displayChecklists.length-1 || reordering" aria-label="下へ移動" @click.prevent="moveChecklist(index,index+1)">↓</button>
              <button type="button" class="delete-checklist-button" :disabled="deletingChecklistId===item.id" title="削除" @click.stop="deleteChecklist(item)">×</button>
            </label>
          </div>


          <div class="checklist-editor inline-editor">
            <input
              v-model="newChecklistTitle"
              class="checklist-input"
              type="text"
              maxlength="200"
              placeholder="チェックリストの内容を入力..."
              @keydown.enter.prevent="addChecklist"
              :disabled="savingChecklist || reordering || checklistLoading || !!checklistError || (checklistTab === 'event' && !selectedSchedule)"
            />

            <button
              class="checklist-save-button"
              :disabled="savingChecklist || reordering || checklistLoading || !!checklistError || !newChecklistTitle.trim() || (checklistTab === 'event' && !selectedSchedule)"
              @click="addChecklist"
            >
              {{ savingChecklist ? '追加中...' : '＋ 追加' }}
            </button>

            <p v-if="checklistError" class="checklist-error">
              {{ checklistError }}
            </p>
          </div>

        </section>

        <section v-else class="memo-section">
          <div class="section-title-row">
            <div><span class="section-label">MEMO</span><h2>{{ dayLabel }}のメモ</h2></div>
          </div>
          <div class="section-divider"></div>
          <textarea v-model="memo" maxlength="500" :placeholder="dayLabel + 'のメモを入力...'"
            :disabled="memoLoading || memoSaving || memoLoadFailed" @input="handleMemoInput"
            @keydown.ctrl.enter.prevent="saveMemo" @keydown.meta.enter.prevent="saveMemo"></textarea>
          <div class="memo-bottom">
            <span :class="['memo-status', { 'memo-error': memoError }]">{{ memoStatus }}</span>
            <button class="save-button" :disabled="memoLoading || memoSaving || !memoDirty" @click="saveMemo">{{ memoSaving ? '保存中...' : '保存' }}</button>
          </div>
        </section>
      </aside>

    </main>
  </div>
</template>


<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch, defineAsyncComponent } from 'vue'
import axios from 'axios'
import { API_ORIGIN } from '../utils/http'
import { useRoute, useRouter, onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router'
import { dateKey, validDate, mapEvent, occursOn } from '../utils/calendar'
const EventWorkspace = defineAsyncComponent(() => import('../components/EventWorkspace.vue'))
const detailEvent = ref(null)
function handleEventChange({event,deleted,checklistOnly}) {
  const key = event.calendarId + ':' + event.id
  const existing = schedules.value.find(item => item.key === key)
  if (!existing) return
  if (checklistOnly) {
    existing.checklists = event.checklists.map(item => ({
      id:item.checklist_id,title:item.title,completed:item.is_completed,eventId:item.event_id,pending:false
    }))
    return
  }
  const updated = deleted ? null : {...existing,...mapEvent({
    ...event,
    calendarColor:event.calendarColor || existing.calendarColor,
    calendarForegroundColor:event.calendarForegroundColor || existing.calendarForegroundColor
  })}
  if (!updated || !occursOn(updated,dateInputValue.value)) {
    schedules.value = schedules.value.filter(item => item.key !== key)
    if(selectedSchedule.value?.key === key){selectedSchedule.value=null;checklistTab.value='general'}
  } else {
    Object.assign(existing,updated)
  }
  // Do not reload the entire day: that would erase an unsaved daily memo.
}
const route = useRoute(), router = useRouter()
const api = axios.create({ baseURL: API_ORIGIN + '/api', withCredentials: true })
const selectedDate = ref(validDate(route.query.date) ? new Date(route.query.date + 'T00:00:00') : new Date())
const dateInput = ref(null)
const dateInputValue = computed({
  get: () => dateKey(selectedDate.value),
  set: value => { if (validDate(value)) navigateDate(value) }
})
const formattedDate = computed(() => new Intl.DateTimeFormat('ja-JP', { year:'numeric', month:'long', day:'numeric', weekday:'short' }).format(selectedDate.value))
const isToday = computed(() => dateInputValue.value === dateKey(new Date()))
const dayLabel = computed(() => isToday.value ? '今日' : 'この日')
const schedules = ref([]), loading = ref(false), syncing = ref(false), scheduleError = ref('')
const selectedSchedule = ref(null), checklistTab = ref('general')
const expandedGroupKey = ref(null)
const orderedSchedules = computed(() => [...schedules.value].sort((a,b) => {
  if (a.allDay !== b.allDay) return a.allDay ? -1 : 1
  return new Date(a.start) - new Date(b.start)
}))
const checklists = ref([]), newChecklistTitle = ref(''), savingChecklist = ref(false)
const checklistError = ref(''), deletingChecklistId = ref(null), checklistLoading = ref(false), reordering = ref(false)
const displayChecklists = computed(() => checklistTab.value === 'general' ? checklists.value : selectedSchedule.value?.checklists || [])
const checklistTitle = computed(() => checklistTab.value === 'general' ? dayLabel.value + 'のタスク' : (selectedSchedule.value?.title || '予定') + 'の準備')
const displayCompletedCount = computed(() => getCompletedCount(displayChecklists.value))
const displayProgress = computed(() => displayChecklists.value.length ? Math.round(displayCompletedCount.value / displayChecklists.value.length * 100) : 0)
const overviewGroups = computed(() => [
  { key:'general', kind:'general', title:dayLabel.value + 'やること', items:checklists.value },
  ...orderedSchedules.value
    .filter(schedule => schedule.checklists.length)
    .sort((a,b) => Number(getCompletedCount(a.checklists) === a.checklists.length) - Number(getCompletedCount(b.checklists) === b.checklists.length))
    .map(schedule => ({ key:schedule.key, kind:'event', title:schedule.title, items:schedule.checklists, schedule }))
])
const overallItems = computed(() => overviewGroups.value.flatMap(group => group.items))
const overallCompleted = computed(() => getCompletedCount(overallItems.value))
const overallProgress = computed(() => overallItems.value.length ? Math.round(overallCompleted.value / overallItems.value.length * 100) : 0)
const memoLoadFailed = ref(false)
const memo = ref(''), memoLoading = ref(false), memoSaving = ref(false), memoDirty = ref(false), memoSaved = ref(false), memoError = ref('')
const memoStatus = computed(() => memoLoading.value ? '読み込み中...' : memoSaving.value ? '保存中...' : memoError.value || (memoDirty.value ? '未保存 · ' : memoSaved.value ? '保存しました · ' : '') + memo.value.length + ' / 500')
let controller, generation = 0
function getCompletedCount(items = []) { return items.filter(item => item.completed).length }
function scheduleProgressLabel(schedule) {
  return schedule.checklists.length ? `${getCompletedCount(schedule.checklists)}/${schedule.checklists.length}` : '準備なし'
}
function toggleOverviewGroup(key) { expandedGroupKey.value = expandedGroupKey.value === key ? null : key }
function mapChecklist(item) { return { id: item.checklist_id, title: item.title, completed: item.is_completed, eventId: item.event_id, pending: false } }
function canLeave() {
  if (memoSaving.value || savingChecklist.value || deletingChecklistId.value || reordering.value) return false
  return (!memoDirty.value && !newChecklistTitle.value.trim()) || window.confirm('未保存のメモ・入力内容を破棄しますか？')
}
onBeforeRouteLeave(canLeave)
onBeforeRouteUpdate((to,from) => {
  if (to.path===from.path && to.query.date===from.query.date) return true
  return canLeave()
})
function beforeUnload(event) {
  if (memoDirty.value || newChecklistTitle.value.trim() || memoSaving.value) { event.preventDefault(); event.returnValue = '' }
}
function navigateDate(value) { router.replace({ path:'/today', query:{ date:value } }) }
function moveDate(amount) { const d = new Date(selectedDate.value); d.setDate(d.getDate() + amount); navigateDate(dateKey(d)) }
function goToday() { navigateDate(dateKey(new Date())) }
function openDatePicker() { dateInput.value?.showPicker ? dateInput.value.showPicker() : dateInput.value?.click() }
function selectDate() {}
function selectSchedule(schedule) {
  if (newChecklistTitle.value.trim() && !window.confirm('入力中の項目を破棄して予定を切り替えますか？')) return
  selectedSchedule.value = schedule
  checklistTab.value = 'event'
  newChecklistTitle.value = ''
}
function openFocus(schedule) {
  if (newChecklistTitle.value.trim() && !window.confirm('入力中の項目を破棄して予定を開きますか？')) return
  newChecklistTitle.value = ''
  router.replace({path:'/today',query:{date:dateInputValue.value,event:schedule.key}})
}
function closeFocus() {
  if (newChecklistTitle.value.trim() && !window.confirm('入力中の項目を破棄して今日の画面に戻りますか？')) return
  newChecklistTitle.value = ''
  router.replace({path:'/today',query:{date:dateInputValue.value}})
}
function setChecklistTab(tab) {
  if (tab === checklistTab.value) return
  if (newChecklistTitle.value.trim() && !window.confirm('入力中の項目を破棄しますか？')) return
  newChecklistTitle.value = ''
  checklistTab.value = tab
}
async function loadData() {
  controller?.abort()
  controller = new AbortController()
  const signal = controller.signal, version = ++generation, date = dateInputValue.value
  const current = () => version === generation && !signal.aborted
  loading.value = true; checklistLoading.value = true; memoLoading.value = true
  scheduleError.value = ''; checklistError.value = ''; memoError.value = ''; memoLoadFailed.value = false
  schedules.value = []; checklists.value = []; selectedSchedule.value = null; checklistTab.value = 'general'
  memo.value = ''; memoDirty.value = false; memoSaved.value = false; newChecklistTitle.value = ''
  const calendarTask = (async () => {
    try {
      const { data } = await api.get('/calendar/events', { params: { date }, signal })
      if (!current()) return
      schedules.value = data.map(event => ({ ...mapEvent(event), checklists: [], checklistKey: (event.calendarId || 'primary') + ':' + event.id }))
      // One batch replaces one HTTP request per event. Legacy raw Google IDs remain readable.
      const keys = [...new Set(schedules.value.flatMap(event => [event.key, event.id]))]
      const rows = []
      for (let i = 0; i < keys.length; i += 1000) {
        const batch = await api.post('/checklists/event-batch', { keys: keys.slice(i, i + 1000) }, { signal })
        rows.push(...batch.data)
      }
      if (!current()) return
      for (const event of schedules.value) {
        const composite = rows.filter(item => item.event_id === event.key)
        const legacy = rows.filter(item => item.event_id === event.id)
        event.checklists = [...composite, ...legacy].map(mapChecklist)
        event.checklistKey = legacy.length && !composite.length ? event.id : event.key
      }
      const requested = schedules.value.find(event => event.key === route.query.event)
      if (requested) { selectedSchedule.value=requested; detailEvent.value=requested; checklistTab.value='event' }
    } catch (error) {
      if (current()) {
        if (schedules.value.length) checklistError.value = '予定のチェックリストを読み込めませんでした。同期で再試行してください。'
        else scheduleError.value = '予定を読み込めませんでした。ログイン状態を確認して再試行してください。'
      }
    } finally { if (current()) loading.value = false }
  })()
  const checklistTask = (async () => {
    try {
      const { data } = await api.get('/checklists', { params: { date }, signal })
      if (current()) checklists.value = data.map(mapChecklist)
    } catch { if (current()) checklistError.value = 'チェックリストを読み込めませんでした。' }
  })()
  const memoTask = (async () => {
    try {
      const { data } = await api.get('/memos/' + date, { signal })
      if (current()) memo.value = data.content || ''
    } catch { if (current()) { memoLoadFailed.value = true; memoError.value = '読み込みに失敗しました。同期で再試行してください。' } }
    finally { if (current()) memoLoading.value = false }
  })()
  await Promise.allSettled([calendarTask, checklistTask, memoTask])
  if (current()) checklistLoading.value = false
}
async function syncCalendar() {
  if (syncing.value || !canLeave()) return
  syncing.value = true
  try { await loadData() } finally { syncing.value = false }
}
async function updateChecklistStatus(item, completed) {
  if (item.pending) return
  const previous = item.completed
  item.completed = completed; item.pending = true
  try { await api.patch('/checklists/' + item.id + '/status', { completed }) }
  catch { item.completed = previous; checklistError.value = '更新できませんでした。再試行してください。' }
  finally { item.pending = false }
}
async function deleteChecklist(item, list = displayChecklists.value) {
  if (deletingChecklistId.value || reordering.value || !window.confirm('このチェックリストを削除しますか？')) return
  deletingChecklistId.value = item.id
  try { await api.delete('/checklists/' + item.id); const index = list.indexOf(item); if (index >= 0) list.splice(index, 1) }
  catch { checklistError.value = '削除できませんでした。' }
  finally { deletingChecklistId.value = null }
}
async function addChecklist() {
  const title = newChecklistTitle.value.trim()
  if (!title || savingChecklist.value || reordering.value || checklistLoading.value || checklistError.value) return
  const list = displayChecklists.value, schedule = checklistTab.value === 'event' ? selectedSchedule.value : null
  if (checklistTab.value === 'event' && !schedule) return
  const version = generation
  savingChecklist.value = true
  try {
    const { data } = await api.post('/checklists', { title, targetDate:dateInputValue.value, eventId:schedule?.checklistKey || null })
    list.push(mapChecklist(data))
    if (version === generation && displayChecklists.value === list && newChecklistTitle.value.trim() === title) newChecklistTitle.value = ''
  } catch { checklistError.value = '追加できませんでした。同期で再試行してください。' }
  finally { savingChecklist.value = false }
}
const dragIndex = ref(null)
async function moveChecklist(from, to, list = displayChecklists.value) {
  if (from === null || to < 0 || to >= list.length || from === to || reordering.value || savingChecklist.value || deletingChecklistId.value) return
  const eventIds = [...new Set(list.map(item => item.eventId || null))]
  if (eventIds.length > 1) { checklistError.value = '旧形式と新形式の項目が混在しています。順序変更にはデータの整理が必要です。'; return }
  const previous = [...list]
  const [item] = list.splice(from,1); list.splice(to,0,item)
  reordering.value = true; dragIndex.value = null
  try { await api.put('/checklists/reorder', { ids:list.map(item => item.id), date:dateInputValue.value, eventId:eventIds[0] || null }) }
  catch { list.splice(0,list.length,...previous); checklistError.value = '順序を保存できませんでした。同期で再試行してください。' }
  finally { reordering.value = false }
}
function handleMemoInput() { memoDirty.value = true; memoSaved.value = false }
async function saveMemo() {
  if (memoLoading.value || memoSaving.value || !memoDirty.value || memoLoadFailed.value) return
  memoSaving.value = true
  memoError.value = ''
  try {
    await api.put('/memos/' + dateInputValue.value, { content:memo.value })
    memoDirty.value = false; memoSaved.value = true
  } catch { memoError.value = '保存に失敗しました。入力内容は保持されています。'; }
  finally { memoSaving.value = false }
}
watch(() => route.query.date, () => {
  selectedDate.value = validDate(route.query.date) ? new Date(route.query.date + 'T00:00:00') : new Date()
  detailEvent.value = null
  loadData()
})
watch(() => route.query.event, value => {
  detailEvent.value = schedules.value.find(event => event.key===value) || null
  if(detailEvent.value){selectedSchedule.value=detailEvent.value;checklistTab.value='event'}
  else{selectedSchedule.value=null;checklistTab.value='general'}
})
onMounted(() => { window.addEventListener('beforeunload', beforeUnload); loadData() })
onBeforeUnmount(() => { controller?.abort(); generation++; window.removeEventListener('beforeunload', beforeUnload) })
</script>


<style scoped>
.event-detail-link { border:0;background:transparent;color:#315cbb;font-size:12px;padding:6px 0;cursor:pointer; }
.order-button { border: 0; background: transparent; cursor: pointer; color: #526176; padding: 3px; }
.order-button:disabled { opacity: .3; cursor: default; }
.todo-row { grid-template-columns: 16px minmax(0,1fr) 20px 20px 24px !important; }


/* =====================================
   Page
===================================== */

.today-page {
  width: 100%;
  min-width: 0;
  height: 100%;
  min-height: 0;

  display: flex;
  flex-direction: column;

  box-sizing: border-box;
}


/* =====================================
   Header
===================================== */

.page-header {
  min-height: 52px;

  display: flex;
  align-items: center;
  justify-content: space-between;

  margin-bottom: 14px;
}


/* 날짜 네비게이션 */

.date-navigation {
  display: grid;

  grid-template-columns:
    38px
    minmax(265px, auto)
    38px;

  align-items: center;

  gap: 8px;
}


.nav-button {
  width: 38px;
  height: 38px;

  display: flex;
  align-items: center;
  justify-content: center;

  border: 1px solid #e2e7ef;
  border-radius: 10px;

  background: #ffffff;

  color: #6e7a8d;

  font-size: 25px;

  cursor: pointer;

  transition: 0.18s ease;
}


.nav-button:hover {
  border-color: #bdd0ff;

  background: #f3f7ff;

  color: #2563eb;
}


.date-picker-wrap {
  position: relative;
}


.date-display {
  width: 100%;

  display: flex;
  align-items: center;
  justify-content: center;

  gap: 8px;

  padding: 7px 14px;

  border: none;
  border-radius: 10px;

  background: transparent;

  cursor: pointer;

  transition: background 0.18s ease;
}


.date-display:hover {
  background: rgba(255, 255, 255, 0.7);
}


.date-main {
  color: #202b3c;

  font-size: 25px;
  font-weight: 700;

  letter-spacing: -0.7px;
}


.date-arrow {
  color: #9aa5b3;

  font-size: 11px;
}


.hidden-date-picker {
  position: absolute;

  width: 1px;
  height: 1px;

  opacity: 0;

  pointer-events: none;
}


/* 오른쪽 버튼 */

.header-actions {
  display: flex;
  align-items: center;

  gap: 9px;
}


.today-button,
.sync-button {
  height: 38px;

  padding: 0 15px;

  border-radius: 9px;

  font-size: 12px;
  font-weight: 600;

  cursor: pointer;

  transition: 0.18s ease;
}


.today-button {
  border: 1px solid #dce4ef;

  background: #ffffff;

  color: #637083;
}


.today-button:hover {
  border-color: #bcd0ff;

  color: #2563eb;

  background: #f5f8ff;
}


.sync-button {
  display: flex;
  align-items: center;

  gap: 6px;

  border: none;

  background: #2563eb;

  color: #ffffff;

  box-shadow:
    0 4px 12px rgba(37, 99, 235, 0.16);
}


.sync-button:hover {
  background: #1f56ce;
}


.sync-button:disabled {
  opacity: 0.7;

  cursor: default;
}


.sync-icon {
  display: inline-block;

  font-size: 17px;
}


.spinning {
  animation: rotate 0.7s linear infinite;
}


@keyframes rotate {

  to {
    transform: rotate(360deg);
  }

}


/* =====================================
   Main Planner
===================================== */

.planner {
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: hidden;

  display: grid;

  grid-template-columns:
    minmax(0, 1.8fr)
    minmax(300px, 0.8fr);

  border: 1px solid #dfe6ef;
  border-radius: 20px;

  background: #ffffff;

  box-shadow:
    0 10px 30px rgba(42, 63, 89, 0.06);
}


/* =====================================
   Left schedule
===================================== */

.schedule-section {
  min-width: 0;
  min-height: 0;
  overflow: auto;

  padding: 26px 30px;

  border-right: 1px solid #edf0f5;
}


@media (max-width: 1100px) {
  .today-page {
    min-height: auto;
  }
}

@media (max-width: 700px) {
  .page-header {
    align-items: flex-start;
    flex-direction: column;
    gap: 14px;
  }

  .header-actions {
    width: 100%;
    justify-content: flex-end;
  }

  .date-navigation {
    width: 100%;
    grid-template-columns: 38px minmax(0, 1fr) 38px;
  }

  .date-main {
    font-size: 20px;
  }

  .schedule-section,
  .todo-section,
  .memo-section {
    padding: 22px 18px;
  }
}

@media (max-width: 520px) {
  .header-actions {
    justify-content: stretch;
  }

  .today-button,
  .sync-button {
    flex: 1;
  }
}


.todo-section,
.memo-section {
  padding: 26px;
  min-height: 0;
  overflow: auto;
}


.todo-section {
  border-bottom: 1px solid #edf0f5;
}

.back-button {
  border: none;
  border-radius: 8px;
  padding: 7px 10px;
  background: #f2f6ff;
  color: #2563eb;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}

.back-button:hover {
  background: #e5edff;
}

.checklist-context {
  margin: -4px 0 14px;
  color: #8a97aa;
  font-size: 11px;
}


/* =====================================
   Section titles
===================================== */

.section-title-row {
  min-height: 38px;

  display: flex;
  align-items: flex-end;
  justify-content: space-between;
}


.section-label {
  display: block;

  margin-bottom: 4px;

  color: #8fa1b8;

  font-size: 9px;
  font-weight: 700;

  letter-spacing: 1.7px;
}


.section-title-row h2 {
  margin: 0;

  color: #273244;

  font-size: 17px;
  font-weight: 700;

  letter-spacing: -0.3px;
}

.checklist-title-row h2 {
  overflow: hidden;
  max-width: 220px;
  text-overflow: ellipsis;
  white-space: nowrap;
}


.section-count {
  color: #8794a7;

  font-size: 11px;
  font-weight: 600;
}


.section-divider {
  height: 1px;

  margin: 14px 0 18px;

  background: #edf0f4;
}


/* =====================================
   Schedule
===================================== */

.schedule-list {
  display: flex;
  flex-direction: column;

  gap: 2px;
}


.schedule-row {
  display: grid;

  grid-template-columns:
    65px
    24px
    minmax(0, 1fr);

  min-height: 72px;
  border-radius: 12px;
  cursor: pointer;
  transition: background 0.18s ease;
}

.schedule-row:hover,
.schedule-row-selected {
  background: #f5f8ff;
}

.schedule-row-expanded {
  background: #f5f8ff;
}


.schedule-time {
  display: flex;
  flex-direction: column;

  align-items: flex-end;

  padding-top: 1px;
}


.schedule-time strong {
  color: #354052;

  font-size: 12px;
  font-weight: 700;
}


.schedule-time span {
  margin-top: 3px;

  color: #a0a9b7;

  font-size: 10px;
}


.schedule-line {
  position: relative;

  display: flex;
  justify-content: center;
}


.schedule-dot {
  width: 8px;
  height: 8px;

  margin-top: 3px;

  border: 3px solid #d9e6ff;
  border-radius: 50%;

  background: #2563eb;

  position: relative;

  z-index: 2;
}


.vertical-line {
  position: absolute;

  top: 17px;
  bottom: -3px;

  width: 1px;

  background: #e2e7ee;
}


.schedule-row:last-child
.vertical-line {
  display: none;
}


.schedule-body {
  padding: 0 0 12px 12px;
}


.schedule-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;

  gap: 10px;
}


.schedule-heading h3 {
  margin: 0;

  color: #273244;

  font-size: 14px;
  font-weight: 650;
}


.schedule-heading p {
  margin: 3px 0 0;

  color: #9ca6b4;

  font-size: 10px;
}

.schedule-description {
  display: -webkit-box;
  overflow: hidden;
  margin-top: 7px;
  color: #596678;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 1;
}

.schedule-description-expanded {
  display: block;
  max-height: 112px;
  overflow: auto;
  padding-right: 8px;
  -webkit-line-clamp: unset;
}

.schedule-description-link {
  color: #2563eb;
  text-decoration: underline;
  text-decoration-color: #a9c0ff;
  overflow-wrap: anywhere;
}

.schedule-description-link:hover {
  color: #1747a6;
  text-decoration-color: #2563eb;
}

.description-hint {
  display: block;
  margin-top: 5px;
  color: #9aa7b8;
  font-size: 10px;
}


.more-button {
  border: none;

  background: transparent;

  color: #a1aab6;

  cursor: pointer;

  font-size: 16px;

  letter-spacing: 1px;
}


.more-button:hover {
  color: #2563eb;
}


/* =====================================
   Event checklist
===================================== */

.event-checklist {
  display: flex;
  flex-wrap: wrap;

  gap: 5px 18px;

  margin-top: 10px;
}


.check-row {
  display: flex;
  align-items: center;

  gap: 7px;

  color: #596678;

  font-size: 11px;

  cursor: pointer;
}


.check-row input,
.todo-row input {
  width: 15px;
  height: 15px;

  margin: 0;

  accent-color: #2563eb;

  cursor: pointer;
}


/* 체크 완료 */

.completed {
  color: #a7afbb !important;

  text-decoration: line-through;

  text-decoration-thickness: 1px;

  text-decoration-color: #a7afbb;
}


/* =====================================
   Todo
===================================== */

.todo-list {
  display: flex;
  flex-direction: column;

  gap: 2px;
}


.todo-row {
  min-height: 34px;

  display: flex;
  align-items: center;

  gap: 9px;

  padding: 2px 4px;

  color: #4d596b;

  font-size: 12px;

  cursor: pointer;

  border-radius: 7px;
}


.todo-row:hover {
  background: #f5f7fb;
}

.delete-checklist-button {
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: auto;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #a7b0bd;
  font-size: 17px;
  line-height: 1;
  cursor: pointer;
  opacity: 0;
  transition: 0.18s ease;
}

.todo-row:hover .delete-checklist-button,
.delete-checklist-button:focus-visible {
  opacity: 1;
}

.delete-checklist-button:hover {
  background: #fff0f0;
  color: #d14343;
}

.delete-checklist-button:disabled {
  opacity: 0.45;
  cursor: default;
}


.add-checklist-button {
  margin-top: 10px;

  padding: 7px 4px;

  border: none;

  background: transparent;

  color: #6b8bc9;

  font-size: 11px;
  font-weight: 600;

  cursor: pointer;
}


.add-checklist-button:hover {
  color: #2563eb;
}

.checklist-editor {
  margin-top: 10px;
}

.checklist-input {
  width: 100%;
  min-height: 34px;
  padding: 7px 9px;
  border: 1px solid #dce5f2;
  border-radius: 8px;
  outline: none;
  box-sizing: border-box;
  color: #4d596b;
  font-size: 12px;
}

.checklist-input:focus {
  border-color: #8eafff;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.08);
}

.checklist-editor-actions {
  display: flex;
  gap: 6px;
  margin-top: 7px;
}

.checklist-save-button,
.checklist-cancel-button {
  padding: 6px 10px;
  border-radius: 7px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}

.checklist-save-button {
  border: 1px solid #2563eb;
  background: #2563eb;
  color: #ffffff;
}

.checklist-cancel-button {
  border: 1px solid #dce4ef;
  background: #ffffff;
  color: #6b7789;
}

.checklist-save-button:disabled,
.checklist-cancel-button:disabled {
  opacity: 0.6;
  cursor: default;
}

.checklist-error {
  margin: 7px 0 0;
  color: #d14343;
  font-size: 11px;
}


/* =====================================
   Memo
===================================== */

.memo-section textarea {
  width: 100%;
  height: 105px;

  box-sizing: border-box;

  padding: 2px 4px;

  resize: none;

  border: none;
  outline: none;

  background: transparent;

  color: #485466;

  font-family: inherit;

  font-size: 12px;

  line-height: 1.7;
}


.memo-section textarea::placeholder {
  color: #b1b9c4;
}


.memo-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;

  margin-top: 7px;

  color: #a7afba;

  font-size: 9px;
}


.save-button {
  padding: 6px 12px;

  border: none;
  border-radius: 7px;

  background: #eef4ff;

  color: #3569ce;

  font-size: 10px;
  font-weight: 600;

  cursor: pointer;
}


.save-button:hover {
  background: #e3edff;
}

.save-button:disabled {
  opacity: 0.5;
  cursor: default;
}

.memo-status.memo-error {
  color: #d14343;
}


/* =====================================
   Empty
===================================== */

.schedule-empty {
  min-height: 260px;

  display: flex;
  align-items: center;
  justify-content: center;

  gap: 14px;

  color: #9ca7b5;
}


.empty-clock {
  width: 34px;
  height: 34px;

  display: flex;
  align-items: center;
  justify-content: center;

  border: 2px solid #d7dfeb;
  border-radius: 50%;

  color: #a9b5c5;
}


.empty-title {
  margin: 0;

  color: #778396;

  font-size: 12px;
  font-weight: 600;
}


.empty-description {
  margin: 4px 0 0;

  color: #adb5c0;

  font-size: 10px;
}


.small-empty {
  padding: 25px 4px;

  color: #a3acb9;

  font-size: 11px;
}

/* =====================================
   Refined schedule and checklist UI
===================================== */

.schedule-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.all-day-group {
  padding: 14px;
  border: 1px solid #e5ebf5;
  border-radius: 14px;
  background: #f8faff;
}

.all-day-label {
  display: block;
  margin-bottom: 9px;
  color: #8190a6;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.all-day-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.all-day-card {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  display: inline-flex;
  align-items: center;
  gap: 12px;
  padding: 9px 11px;
  border: 1px solid #dce5f4;
  border-radius: 10px;
  background: #ffffff;
  color: #344155;
  cursor: pointer;
  transition: 0.18s ease;
}

.all-day-card:hover,
.all-day-card.selected {
  border-color: #8cacfa;
  background: #edf3ff;
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.08);
}

.all-day-card-title {
  overflow: hidden;
  max-width: 260px;
  font-size: 12px;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.schedule-row {
  width: 100%;
  padding: 8px 8px 0 0;
  border: 1px solid transparent;
  background: transparent;
  font-family: inherit;
  text-align: left;
}

.schedule-row-selected {
  border-color: #cbdcff;
  background: #f2f6ff;
  box-shadow: 0 5px 16px rgba(37, 99, 235, 0.07);
}

.schedule-row-selected .schedule-dot {
  box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.1);
}

.schedule-progress-count {
  flex: 0 0 auto;
  min-width: 34px;
  padding: 3px 7px;
  border-radius: 999px;
  background: #edf3ff;
  color: #4772c7;
  font-size: 10px;
  font-weight: 700;
  text-align: center;
}

.timed-empty {
  padding: 24px 0;
  color: #a3acb9;
  font-size: 11px;
  text-align: center;
}

.checklist-title-row {
  align-items: center;
}

.checklist-total {
  padding: 6px 10px;
  border-radius: 999px;
  background: #eef4ff;
  color: #3268ce;
  font-size: 12px;
  font-weight: 750;
}

.checklist-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
  margin-bottom: 16px;
  padding: 4px;
  border-radius: 10px;
  background: #f3f6fa;
}

.checklist-tabs button {
  min-width: 0;
  padding: 8px 6px;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: #7b8798;
  font-size: 10px;
  font-weight: 650;
  cursor: pointer;
}

.checklist-tabs button.active {
  background: #ffffff;
  color: #285fc4;
  box-shadow: 0 2px 8px rgba(54, 73, 99, 0.09);
}

.checklist-tabs button:disabled {
  opacity: 0.45;
  cursor: default;
}

.checklist-tabs button span {
  margin-left: 3px;
  color: #9aa5b5;
}

.selected-event-summary {
  min-height: 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
  color: #8b97a8;
  font-size: 10px;
}

.selected-event-summary strong {
  color: #1f9a69;
  font-weight: 700;
}

.progress-track {
  width: 100%;
  height: 5px;
  overflow: hidden;
  margin-bottom: 15px;
  border-radius: 999px;
  background: #edf1f6;
}

.progress-track span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: #16856b;
  transition: width 0.25s ease;
}

.small-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  padding: 22px 8px 12px;
  text-align: center;
}

.small-empty strong {
  color: #788597;
  font-size: 12px;
}

.inline-editor {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 7px;
  margin-top: 14px;
  padding-top: 13px;
  border-top: 1px solid #eef1f5;
}

.inline-editor .checklist-save-button {
  border: none;
  white-space: nowrap;
}

.inline-editor .checklist-error {
  grid-column: 1 / -1;
}

@media (max-width: 520px) {
  .all-day-card {
    width: 100%;
    justify-content: space-between;
  }
}

/* Unified high-contrast color system */
.today-page {
  color: #243247;
}

.nav-button:hover {
  border-color: #315cbb;
  background: #ffffff;
  color: #244a9a;
}

.sync-button {
  background: #315cbb;
  box-shadow: 0 4px 12px rgba(28, 54, 105, 0.2);
}

.sync-button:hover {
  background: #244a9a;
}

.planner {
  border-color: #cfd8e6;
  box-shadow: 0 10px 30px rgba(34, 50, 71, 0.09);
}

.section-label {
  color: #667892;
}

.all-day-group {
  border-color: #d5ddea;
  background: #f2f4f8;
}

.all-day-card:hover,
.all-day-card.selected {
  border-color: #315cbb;
  background: #e4eaf5;
  box-shadow: 0 4px 12px rgba(28, 54, 105, 0.1);
}

.schedule-row:hover {
  background: #f1f3f7;
}

.schedule-row-selected {
  border-color: #315cbb;
  background: #e9eef7;
  box-shadow: 0 5px 16px rgba(28, 54, 105, 0.1);
}

.schedule-dot {
  border-color: #cbd8ee;
  background: #315cbb;
}

.schedule-progress-count {
  background: #dfe6f2;
  color: #273c5c;
}

.checklist-total {
  background: #273c5c;
  color: #ffffff;
}

.checklist-tabs {
  border: 1px solid #d6dde8;
  background: #e9edf3;
}

.checklist-tabs button {
  color: #536176;
}

.checklist-tabs button.active {
  background: #273c5c;
  color: #ffffff;
  box-shadow: none;
}

.checklist-tabs button span {
  color: inherit;
  opacity: 0.75;
}

.progress-track span {
  background: #16856b;
}

.checklist-save-button {
  border-color: #315cbb;
  background: #315cbb;
}

.save-button {
  background: #dfe6f2;
  color: #273c5c;
}

.save-button:hover {
  background: #cfd9e8;
}

/* Single authoritative workspace layout. */
.workspace-grid{grid-template-columns:280px minmax(0,1fr) 320px;grid-template-rows:minmax(0,1fr)}
.workspace-grid>.schedule-section{min-width:0;min-height:0;padding:22px 18px;border-right:1px solid #edf0f5;overflow:auto}
.center-column{min-width:0;min-height:0;display:flex;flex-direction:column;border-right:1px solid #edf0f5;overflow:hidden}
.overview-section{display:flex;flex:1;min-height:0;flex-direction:column;padding:24px 26px;overflow:hidden}
.overview-title-row h2{margin-top:5px}.overview-summary{display:flex;min-height:26px;align-items:center;justify-content:space-between;gap:12px;color:#78869b;font-size:10px}.overview-summary strong{color:#16856b;font-size:10px}.overview-groups{display:flex;min-height:0;flex:1;flex-direction:column;gap:8px;margin:14px -5px 0 0;padding-right:5px;overflow:auto}.overview-group{flex:0 0 auto;overflow:hidden;border:1px solid #dfe5ee;border-radius:12px;background:#fff;transition:border-color .18s,box-shadow .18s}.overview-group.expanded{border-color:#c9d6ee;box-shadow:0 4px 12px rgba(39,60,92,.05)}.overview-group-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;background:#f7f8fa}.overview-group-heading>div{display:flex;min-width:0;align-items:center;gap:9px}.overview-group-heading span{flex:0 0 auto;color:#315cbb;font-size:8px;font-weight:900;letter-spacing:.12em}.overview-group-heading strong{overflow:hidden;color:#182c49;font-size:11px;text-overflow:ellipsis;white-space:nowrap}.overview-group-heading small{flex:0 0 auto;color:#6f7d91;font-size:10px;font-weight:800}.event-group-heading{padding:0 8px 0 0}.overview-toggle{display:grid;min-width:0;flex:1;grid-template-columns:18px 38px minmax(0,1fr) auto;align-items:center;gap:8px;padding:11px 8px 11px 12px;border:0;background:transparent;text-align:left;cursor:pointer}.overview-toggle:hover{background:#f0f3f8}.overview-toggle .accordion-arrow{color:#315cbb;font-size:18px;line-height:1;letter-spacing:0}.overview-toggle .event-time-label{color:#5f7087;font-size:9px;letter-spacing:0}.overview-detail-button{flex:0 0 auto;padding:6px 8px;border:1px solid #d5deeb;border-radius:7px;background:#fff;color:#315cbb;font-size:9px;font-weight:700;cursor:pointer}.overview-detail-button:hover{border-color:#315cbb;background:#eef3ff}.overview-list{margin:0;padding:3px 10px 6px}.overview-list .todo-row{min-height:38px}.overview-group-empty{padding:13px;color:#96a1b1;font-size:10px}.overview-empty{flex:1}.overview-editor{flex:0 0 auto;margin-top:14px}.all-day-time strong{display:inline-flex;padding:3px 7px;border-radius:6px;background:#e8eefb;color:#315cbb;font-size:9px}.unified-schedule-list{display:flex;flex-direction:column;gap:3px}
.embedded-detail{flex:1;min-height:0;border:0;border-radius:0;box-shadow:none}
.checklist-column{min-width:0;min-height:0;overflow:hidden}
.checklist-column .todo-section{height:100%;border:0;padding:24px 22px;overflow:auto}
.checklist-column .memo-section{display:flex;height:100%;min-height:0;flex-direction:column;padding:24px 22px;border:0;overflow:hidden}.checklist-column .memo-section textarea{flex:1;min-height:160px}
.workspace-grid .schedule-row{grid-template-columns:42px 18px minmax(0,1fr)}.workspace-grid .schedule-heading{gap:6px}.workspace-grid .schedule-progress-count{font-size:9px;white-space:nowrap}
@media(max-width:1050px){
  .workspace-grid{grid-template-columns:minmax(0,1fr) 300px;grid-template-rows:190px minmax(0,1fr);overflow:hidden}
  .workspace-grid>.schedule-section{grid-column:1/3;grid-row:1;padding:16px 20px;border-right:0;border-bottom:1px solid #edf0f5}
  .center-column{grid-column:1;grid-row:2}.checklist-column{grid-column:2;grid-row:2}
  .workspace-grid .unified-schedule-list{display:flex;flex-direction:row;gap:8px;overflow:auto}.workspace-grid .schedule-row{min-width:260px}
}
@media(max-width:700px){
  .workspace-grid{display:flex;flex-direction:column;overflow:auto}.workspace-grid>.schedule-section{flex:0 0 auto;min-height:280px;border-right:0}.center-column{flex:0 0 auto;min-height:520px;border-right:0;border-bottom:1px solid #edf0f5;overflow:visible}.overview-section{min-height:520px}.embedded-detail{min-height:620px}.checklist-column{flex:0 0 auto;min-height:420px;overflow:visible}.checklist-column .todo-section,.checklist-column .memo-section{height:auto;min-height:420px}.workspace-grid .unified-schedule-list{display:block}.workspace-grid .schedule-row{min-width:0}
}

</style>
