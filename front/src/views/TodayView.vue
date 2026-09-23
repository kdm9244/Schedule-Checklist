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
    <main class="planner workspace-grid ui-surface">

      <!-- 일정 -->
      <section class="schedule-section">

        <WorkspaceSectionHeader eyebrow="SCHEDULE" :title="dayLabel + 'の予定'">
          <template #actions><span class="section-count">{{ schedules.length }}件</span></template>
        </WorkspaceSectionHeader>


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
      <section v-if="!detailEvent" class="overview-section workspace-pane-content">
        <WorkspaceSectionHeader eyebrow="CHECKLIST OVERVIEW" :title="dayLabel + 'の全チェックリスト'">
          <template #actions><span class="checklist-total">{{ overallCompleted }}/{{ overallItems.length }}</span></template>
        </WorkspaceSectionHeader>
        <div v-if="overallItems.length && overallCompleted === overallItems.length" class="overview-summary"><strong>✓ すべて完了</strong></div>
        <div class="progress-track" aria-hidden="true"><span :style="{ width: `${overallProgress}%` }"></span></div>
        <p v-if="eventChecklistError" class="checklist-error overview-error">{{ eventChecklistError }}</p>

        <div v-if="checklistLoading" class="small-empty"><span>チェックリストを読み込んでいます...</span></div>
        <div v-else-if="!checklistError && overallItems.length === 0" class="small-empty overview-empty">
          <strong>まだ項目がありません</strong><span>{{ dayLabel }}のチェックリストを追加しましょう。</span>
        </div>
        <div v-else class="overview-groups">
          <section v-for="group in overviewGroups" :key="group.key" :class="['overview-group','workspace-content-card', { expanded:isOverviewGroupExpanded(group.key) }]">
            <div class="overview-group-heading event-group-heading">
              <button class="overview-toggle" type="button" :aria-expanded="isOverviewGroupExpanded(group.key)" @click="toggleOverviewGroup(group.key)">
                <span class="accordion-arrow">{{ isOverviewGroupExpanded(group.key) ? '⌄' : '›' }}</span>
                <span class="event-time-label">{{ group.kind === 'general' ? 'GENERAL' : group.schedule.allDay ? '終日' : group.schedule.startTime }}</span>
                <strong>{{ group.title }}</strong>
                <small>{{ getCompletedCount(group.items) }}/{{ group.items.length }}</small>
              </button>
              <button v-if="group.kind === 'event'" class="overview-detail-button" type="button" @click="openFocus(group.schedule)">詳細</button>
            </div>
            <div v-if="isOverviewGroupExpanded(group.key) && group.kind === 'general' && group.items.length === 0" class="overview-group-empty">チェックリストはまだありません</div>
            <div v-else-if="isOverviewGroupExpanded(group.key)" class="todo-list overview-list">
              <label v-for="(item,index) in group.items" :key="item.id" class="todo-row"
                :draggable="!reordering" @dragstart="dragIndex=index" @dragover.prevent @drop.prevent="moveChecklist(dragIndex,index,group.items)">
                <input :checked="item.completed" :disabled="item.pending" type="checkbox" @change="updateChecklistStatus(item,$event.target.checked)">
                <span :class="{completed:item.completed}">{{ item.title }}</span>
                <button type="button" class="order-button" :disabled="index===0 || reordering" aria-label="上へ移動" @click.prevent="moveChecklist(index,index-1,group.items)">↑</button>
                <button type="button" class="order-button" :disabled="index===group.items.length-1 || reordering" aria-label="下へ移動" @click.prevent="moveChecklist(index,index+1,group.items)">↓</button>
                <button type="button" class="edit-checklist-button" :disabled="editingBusy" title="編集" @click.stop="openChecklistEditor(item,group.items)">✎</button>
              </label>
            </div>
          </section>
        </div>

        <div class="checklist-editor inline-editor overview-editor">
          <input ref="checklistInput" v-model="newChecklistTitle" class="checklist-input" type="text" maxlength="200"
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

          <WorkspaceSectionHeader eyebrow="CHECKLIST" :title="checklistTitle">
            <template #actions><span class="checklist-total">{{ displayCompletedCount }}/{{ displayChecklists.length }}</span></template>
          </WorkspaceSectionHeader>

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
              <div>{{ dayLabel }}のチェックリスト</div>
              <strong v-if="displayChecklists.length && displayCompletedCount === displayChecklists.length">✓ すべて完了</strong>
              <span v-else>{{ dayLabel }}のタスクを確認しましょう</span>
            </template>
          </div>

          <div class="progress-track" aria-hidden="true">
            <span :style="{ width: `${displayProgress}%` }"></span>
          </div>

          <div v-if="!checklistLoading && !checklistError && displayChecklists.length === 0" class="small-empty">
            <strong>まだ項目がありません</strong>
            <span>{{ checklistTab === 'event' ? 'この予定に必要なものを追加しましょう。' : 'チェックリストを追加しましょう。' }}</span>
          </div>

          <div v-else class="todo-list">
            <label v-for="(item,index) in displayChecklists" :key="item.id" class="todo-row"
              :draggable="!reordering" @dragstart="dragIndex=index" @dragover.prevent @drop.prevent="moveChecklist(dragIndex,index)">
              <input :checked="item.completed" :disabled="item.pending" type="checkbox" @change="updateChecklistStatus(item,$event.target.checked)">
              <span :class="{completed:item.completed}">{{ item.title }}</span>
              <button type="button" class="order-button" :disabled="index===0 || reordering" aria-label="上へ移動" @click.prevent="moveChecklist(index,index-1)">↑</button>
              <button type="button" class="order-button" :disabled="index===displayChecklists.length-1 || reordering" aria-label="下へ移動" @click.prevent="moveChecklist(index,index+1)">↓</button>
              <button type="button" class="edit-checklist-button" :disabled="editingBusy" title="編集" @click.stop="openChecklistEditor(item,displayChecklists)">✎</button>
            </label>
          </div>


          <div class="checklist-editor inline-editor">
            <input
              ref="checklistInput"
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
          <WorkspaceSectionHeader eyebrow="MEMO" :title="dayLabel + 'のメモ'" />
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
    <ChecklistEditModal v-if="editingChecklist" :title="editingChecklist.title" :busy="editingBusy" :error="checklistEditError"
      @close="closeChecklistEditor" @save="saveChecklistEdit" @delete="deleteChecklistEdit" />
  </div>
</template>


<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch, defineAsyncComponent, nextTick } from 'vue'
import axios from 'axios'
import { API_ORIGIN } from '../utils/http'
import { useRoute, useRouter, onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router'
import { dateKey, validDate, mapEvent, occursOn } from '../utils/calendar'
import WorkspaceSectionHeader from '../components/WorkspaceSectionHeader.vue'
const EventWorkspace = defineAsyncComponent(() => import('../components/EventWorkspace.vue'))
const ChecklistEditModal = defineAsyncComponent(() => import('../components/ChecklistEditModal.vue'))
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
const expandedGroupKeys = ref(new Set(['general']))
const orderedSchedules = computed(() => [...schedules.value].sort((a,b) => {
  if (a.allDay !== b.allDay) return a.allDay ? -1 : 1
  return new Date(a.start) - new Date(b.start)
}))
const checklists = ref([]), newChecklistTitle = ref(''), savingChecklist = ref(false)
const checklistInput = ref(null)
const checklistError = ref(''), deletingChecklistId = ref(null), checklistLoading = ref(false), reordering = ref(false)
const editingChecklist = ref(null), editingChecklistList = ref(null), editingBusy = ref(false), checklistEditError = ref('')
const eventChecklistError = ref('')
const displayChecklists = computed(() => checklistTab.value === 'general' ? checklists.value : selectedSchedule.value?.checklists || [])
const checklistTitle = computed(() => checklistTab.value === 'general' ? dayLabel.value + 'のチェックリスト' : (selectedSchedule.value?.title || '予定') + 'の準備')
const displayCompletedCount = computed(() => getCompletedCount(displayChecklists.value))
const displayProgress = computed(() => displayChecklists.value.length ? Math.round(displayCompletedCount.value / displayChecklists.value.length * 100) : 0)
const overviewGroups = computed(() => [
  { key:'general', kind:'general', title:dayLabel.value + 'のチェックリスト', items:checklists.value },
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
function isOverviewGroupExpanded(key) { return expandedGroupKeys.value.has(key) }
function toggleOverviewGroup(key) {
  const next = new Set(expandedGroupKeys.value)
  next.has(key) ? next.delete(key) : next.add(key)
  expandedGroupKeys.value = next
}
function mapChecklist(item) { return { id: item.checklist_id, title: item.title, completed: item.is_completed, eventId: item.event_id, pending: false } }
function canLeave() {
  if (memoSaving.value || savingChecklist.value || deletingChecklistId.value || reordering.value || editingBusy.value) return false
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
  scheduleError.value = ''; checklistError.value = ''; eventChecklistError.value = ''; memoError.value = ''; memoLoadFailed.value = false
  schedules.value = []; checklists.value = []; selectedSchedule.value = null; checklistTab.value = 'general'
  memo.value = ''; memoDirty.value = false; memoSaved.value = false; newChecklistTitle.value = ''
  const calendarTask = (async () => {
    try {
      const { data } = await api.get('/calendar/events', { params: { date }, signal })
      if (!current()) return
      schedules.value = data.map(event => ({ ...mapEvent(event), checklists: [], checklistKey: (event.calendarId || 'primary') + ':' + event.id }))
    } catch {
      if (current()) scheduleError.value = '予定を読み込めませんでした。ログイン状態を確認して再試行してください。'
      return
    }
    try {
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
    } catch {
      if (current()) eventChecklistError.value = '予定のチェックリストを読み込めませんでした。同期で再試行してください。'
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
function openChecklistEditor(item,list){editingChecklist.value=item;editingChecklistList.value=list;checklistEditError.value=''}
function closeChecklistEditor(){if(!editingBusy.value){editingChecklist.value=null;editingChecklistList.value=null;checklistEditError.value=''}}
async function saveChecklistEdit(title){
  if(!editingChecklist.value||editingBusy.value)return
  editingBusy.value=true;checklistEditError.value=''
  try{const {data}=await api.patch('/checklists/'+editingChecklist.value.id,{title});editingChecklist.value.title=data.title;closeChecklistEditor()}
  catch(e){checklistEditError.value=e.response?.data?.message||'更新できませんでした。'}
  finally{editingBusy.value=false;if(!checklistEditError.value)closeChecklistEditor()}
}
async function deleteChecklistEdit(){
  if(!editingChecklist.value||editingBusy.value)return
  const item=editingChecklist.value,list=editingChecklistList.value
  editingBusy.value=true;deletingChecklistId.value=item.id;checklistEditError.value=''
  try{await api.delete('/checklists/'+item.id);const index=list?.indexOf(item)??-1;if(index>=0)list.splice(index,1)}
  catch(e){checklistEditError.value=e.response?.data?.message||'削除できませんでした。'}
  finally{editingBusy.value=false;deletingChecklistId.value=null;if(!checklistEditError.value)closeChecklistEditor()}
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
  finally {
    savingChecklist.value = false
    await nextTick()
    checklistInput.value?.focus()
  }
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
  expandedGroupKeys.value = new Set(['general'])
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

.section-count {
  color: #8794a7;

  font-size: 11px;
  font-weight: 600;
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

.edit-checklist-button {
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
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  opacity: 0;
  transition: 0.18s ease;
}

.todo-row:hover .edit-checklist-button,
.edit-checklist-button:focus-visible {
  opacity: 1;
}

.edit-checklist-button:hover {
  background: #eaf0fb;
  color: #315cbb;
}

.edit-checklist-button:disabled {
  opacity: 0.45;
  cursor: default;
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

.checklist-save-button {
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

.checklist-save-button:disabled {
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

.checklist-total {
  padding: 6px 10px;
  border-radius: 999px;
  background: #eef4ff;
  color: #3268ce;
  font-size: 12px;
  font-weight: 750;
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
.workspace-grid>.schedule-section{min-width:0;min-height:0;padding:24px 20px;border-right:1px solid #edf0f5;overflow:auto}
.center-column{min-width:0;min-height:0;display:flex;flex-direction:column;border-right:1px solid #edf0f5;overflow:hidden}
.overview-section{display:flex;flex:1;min-height:0;flex-direction:column;overflow:hidden}
.overview-summary{display:flex;min-height:26px;align-items:center;justify-content:space-between;gap:12px;color:#78869b;font-size:10px}.overview-summary strong{color:#16856b;font-size:10px}.overview-groups{display:flex;min-height:0;flex:1;flex-direction:column;gap:8px;margin:14px -5px 0 0;padding-right:5px;overflow:auto}.overview-group{flex:0 0 auto;overflow:hidden;border:1px solid #dfe5ee;border-radius:12px;background:#fff;transition:border-color .18s,box-shadow .18s}.overview-group.expanded{border-color:#c9d6ee;box-shadow:0 4px 12px rgba(39,60,92,.05)}.overview-group-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;background:#f7f8fa}.overview-group-heading>div{display:flex;min-width:0;align-items:center;gap:9px}.overview-group-heading span{flex:0 0 auto;color:#315cbb;font-size:8px;font-weight:900;letter-spacing:.12em}.overview-group-heading strong{overflow:hidden;color:#182c49;font-size:11px;text-overflow:ellipsis;white-space:nowrap}.overview-group-heading small{flex:0 0 auto;color:#6f7d91;font-size:10px;font-weight:800}.event-group-heading{padding:0 8px 0 0}.overview-toggle{display:grid;min-width:0;flex:1;grid-template-columns:18px 38px minmax(0,1fr) auto;align-items:center;gap:8px;padding:11px 8px 11px 12px;border:0;background:transparent;text-align:left;cursor:pointer}.overview-toggle:hover{background:#f0f3f8}.overview-toggle .accordion-arrow{color:#315cbb;font-size:18px;line-height:1;letter-spacing:0}.overview-toggle .event-time-label{color:#5f7087;font-size:9px;letter-spacing:0}.overview-detail-button{flex:0 0 auto;padding:6px 8px;border:1px solid #d5deeb;border-radius:7px;background:#fff;color:#315cbb;font-size:9px;font-weight:700;cursor:pointer}.overview-detail-button:hover{border-color:#315cbb;background:#eef3ff}.overview-list{margin:0;padding:3px 10px 6px}.overview-list .todo-row{min-height:38px}.overview-group-empty{padding:13px;color:#96a1b1;font-size:10px}.overview-empty{flex:1}.overview-editor{flex:0 0 auto;margin-top:14px}.all-day-time strong{display:inline-flex;padding:3px 7px;border-radius:6px;background:#e8eefb;color:#315cbb;font-size:9px}.unified-schedule-list{display:flex;flex-direction:column;gap:3px}
.embedded-detail{flex:1;min-height:0}
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
  .today-page{height:auto;min-height:100%}.workspace-grid{display:flex;overflow:visible;flex-direction:column}.workspace-grid>.schedule-section{flex:0 0 auto;min-height:0;border-right:0}.center-column{flex:0 0 auto;min-height:0;border-right:0;border-bottom:1px solid #edf0f5;overflow:visible}.overview-section{min-height:420px}.embedded-detail{height:auto}.embedded-detail :deep(.workspace-body),.embedded-detail :deep(.information-pane){overflow:visible}.checklist-column{flex:0 0 auto;min-height:0;overflow:visible}.checklist-column .todo-section,.checklist-column .memo-section{height:auto;min-height:360px}.workspace-grid .unified-schedule-list{display:block}.workspace-grid .schedule-row{min-width:0}
}

</style>
