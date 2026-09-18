<template>
  <div class="calendar-page">
    <header class="calendar-header">
      <div>
        <span class="page-label">CALENDAR</span>
        <label class="month-picker"><span class="sr-only">表示する年月</span><input aria-label="表示する年月" type="month" :value="monthInput" @change="jumpMonth($event.target.value)" /></label>
      </div>
      <div class="calendar-actions">
        <button class="secondary-button" @click="goToday">今日</button>
        <div class="month-navigation">
          <button aria-label="前の月" @click="moveMonth(-1)">‹</button>
          <button aria-label="次の月" @click="moveMonth(1)">›</button>
        </div>
        <button class="sync-button" :disabled="loading" @click="syncCalendar">
          <span :class="{ spinning: loading }">↻</span> 同期
        </button>
      </div>
    </header>

    <main v-if="detailEvent" class="calendar-focus-layout">
      <aside class="calendar-focus-agenda">
        <button class="focus-return" @click="closeFocus">← 月間カレンダーへ</button>
        <span class="page-label">DAY AGENDA</span>
        <h2>{{ selectedDateTitle }}</h2>
        <div class="focus-event-list">
          <button v-for="event in selectedEvents" :key="event.key"
            :class="{active:event.key===detailEvent.key}" @click="openFocus(event)">
            <span>{{ event.allDay ? '終日' : event.startTime }}</span>
            <strong>{{ event.title }}</strong>
            <small>{{ eventProgressLabel(event) }}</small>
          </button>
        </div>
      </aside>
      <EventWorkspace :key="detailEvent.key" :event="detailEvent" @close="closeFocus" @changed="handleEventChange" />
    </main>

    <main v-show="!detailEvent" class="calendar-shell">
      <section class="month-panel" @wheel="handleCalendarWheel">
        <p v-if="error" class="load-error" role="alert">{{ error }} <button @click="loadMonth">再試行</button></p>
        <p v-if="loading" class="loading-note" role="status">読み込み中...</p>
        <FullCalendar ref="calendarRef" :options="calendarOptions" />
      </section>

      <aside class="day-panel">
        <div class="day-panel-header">
          <div>
            <span class="page-label">SELECTED DATE</span>
            <h2>{{ selectedDateTitle }}</h2>
          </div>
          <button class="compact-add-button" title="この日に予定を追加" @click="openCreateEvent">＋</button>
        </div>

        <p v-if="detailError" role="alert" class="load-error">{{ detailError }}</p>
        <div class="day-summary" :aria-busy="detailLoading">
          <span>予定 <b>{{ selectedEvents.length }}</b></span>
          <span>タスク <b>{{ completedTasks }}/{{ selectedTasks.length }}</b></span>
          <span :class="{ active: selectedMemo }">メモ {{ selectedMemo ? 'あり' : 'なし' }}</span>
        </div>

        <div class="day-panel-content">
          <p v-if="detailLoading" role="status">読み込み中...</p>
          <section v-if="selectedEvents.length" class="detail-section">
            <h3>予定</h3>
            <button v-for="event in selectedEvents" :key="event.key" class="detail-event" :style="{ '--event-color':event.calendarColor }" @click="openFocus(event)">
              <span class="detail-time">{{ event.allDay ? '終日' : event.startTime }}</span>
              <span class="detail-event-body">
                <strong>{{ event.title }}</strong>
                <small v-if="event.location">{{ event.location }}</small>
              </span>
              <span class="event-check-count">{{ eventProgressLabel(event) }}</span>
              <span class="detail-arrow">›</span>
            </button>
          </section>

          <div v-else-if="!loading && !error" class="panel-empty">
            <div class="empty-icon">○</div>
            <strong>この日の予定はありません</strong>
            <span>新しい予定を追加して一日を計画しましょう。</span>
            <button @click="openCreateEvent">この日に予定を追加</button>
          </div>

          <section v-if="selectedTasks.length" class="detail-section task-preview">
            <div class="detail-section-heading">
              <h3>この日のタスク</h3>
              <span>{{ completedTasks }}/{{ selectedTasks.length }}</span>
            </div>
            <div class="task-progress"><span :style="{ width: taskProgress + '%' }"></span></div>
            <p v-for="task in selectedTasks.slice(0, 3)" :key="task.id" :class="{ completed: task.completed }">
              {{ task.completed ? '✓' : '○' }} {{ task.title }}
            </p>
          </section>
        </div>

        <button class="detail-button" @click="openDayDetail">この日の詳細を見る</button>
      </aside>
    </main>
  </div>
</template>

<script setup>
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import axios from 'axios'
import { API_ORIGIN } from '../utils/http'
const EventWorkspace = defineAsyncComponent(() => import('../components/EventWorkspace.vue'))
import FullCalendar from '@fullcalendar/vue3'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import jaLocale from '@fullcalendar/core/locales/ja'
import { dateKey, validDate, mapEvent, occursOn, toCalendarInput } from '../utils/calendar'

const router = useRouter()
const route = useRoute()
const initial = validDate(route.query.date) ? new Date(route.query.date + 'T00:00:00') : new Date()
const calendarRef = ref(null)
const displayedMonth = ref(new Date(initial.getFullYear(), initial.getMonth(), 1))
const selectedDate = ref(initial)
const events = ref([])
const detailEvent = ref(null)
const selectedTasks = ref([])
const selectedMemo = ref('')
const loading = ref(false)
const error = ref('')
const detailLoading = ref(false)
const detailError = ref('')
let range = null
let monthRequest
let detailRequest
let wheelLock = false
let wheelLockTimer
const monthInput = computed(() => dateKey(displayedMonth.value).slice(0,7))
const selectedDateKey = computed(() => dateKey(selectedDate.value))
const selectedDateTitle = computed(() => new Intl.DateTimeFormat('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' }).format(selectedDate.value))
const selectedEvents = computed(() => events.value.filter(event => occursOn(event, selectedDateKey.value)))
const completedTasks = computed(() => selectedTasks.value.filter(task => task.completed).length)
const taskProgress = computed(() => selectedTasks.value.length ? Math.round(completedTasks.value / selectedTasks.value.length * 100) : 0)
function eventProgressLabel(event) {
  const items = event.checklists || []
  return items.length ? `${items.filter(item => item.completed).length}/${items.length}` : '準備なし'
}
function calendarEventTitle(event) {
  return event.checklists?.length ? `${event.title}  ${eventProgressLabel(event)}` : event.title
}
const calendarOptions = computed(() => ({
  plugins: [dayGridPlugin, interactionPlugin], locale: jaLocale, initialView: 'dayGridMonth',
  initialDate: initial, headerToolbar: false, height: '100%', fixedWeekCount: true,
  dayMaxEvents: 2, editable: false, eventStartEditable: false,
  events: events.value.map(event => ({ ...toCalendarInput(event), title: calendarEventTitle(event) })),
  dayCellClassNames: info => dateKey(info.date) === selectedDateKey.value ? ['selected-date'] : [],
  dateClick: info => selectDay(info.date),
  eventClick: info => {
    const event = events.value.find(item => item.key === info.event.id)
    if (event) {
      if (!occursOn(event, selectedDateKey.value)) selectedDate.value = new Date(event.allDay ? event.start.slice(0,10) + 'T00:00:00' : event.start)
      openFocus(event)
    }
  },
  datesSet: info => {
    displayedMonth.value = new Date(info.view.currentStart)
    range = { start: new Date(info.start), end: new Date(info.end) }
    loadMonth()
  }
}))

async function loadMonth() {
  if (!range) return
  monthRequest?.abort()
  const request = new AbortController()
  monthRequest = request
  loading.value = true
  error.value = ''
  events.value = []
  const end = new Date(range.end)
  end.setDate(end.getDate() - 1)
  try {
    const response = await axios.get(API_ORIGIN + '/api/calendar/events', {
      params: { startDate: dateKey(range.start), endDate: dateKey(end) },
      signal: request.signal, withCredentials: true
    })
    if (!request.signal.aborted) {
      events.value = response.data.map(event => ({ ...mapEvent(event), checklists: [] }))
      const keys = [...new Set(events.value.flatMap(event => [event.key, event.id]))]
      if (keys.length) {
        const rows = []
        for (let i = 0; i < keys.length; i += 1000) {
          const batch = await axios.post(API_ORIGIN + '/api/checklists/event-batch', { keys: keys.slice(i, i + 1000) }, {
            withCredentials: true, signal: request.signal
          })
          rows.push(...batch.data)
        }
        for (const event of events.value) {
          event.checklists = rows.filter(item => item.event_id === event.key || item.event_id === event.id).map(item => ({
            id:item.checklist_id,title:item.title,completed:item.is_completed,eventId:item.event_id
          }))
        }
      }
      const requested=events.value.find(event=>event.key===route.query.event)
      if(requested)detailEvent.value=requested
    }
  } catch (err) {
    if (!axios.isCancel(err)) error.value = '予定を読み込めませんでした。接続を確認して再試行してください。'
  } finally { if (monthRequest === request) loading.value = false }
}

function syncCalendar() { loadMonth(); loadSelectedDateData() }

async function loadSelectedDateData() {
  detailRequest?.abort()
  const request = new AbortController()
  detailRequest = request
  selectedTasks.value = []
  selectedMemo.value = ''
  detailError.value = ''
  detailLoading.value = true
  const date = selectedDateKey.value
  const config = { withCredentials: true, signal: request.signal }
  const [tasks, memo] = await Promise.allSettled([
    axios.get(API_ORIGIN + '/api/checklists', { ...config, params: { date } }),
    axios.get(API_ORIGIN + '/api/memos/' + date, config)
  ])
  if (request.signal.aborted) return
  if (tasks.status === 'fulfilled') selectedTasks.value = tasks.value.data.map(item => ({
    id: item.checklist_id, title: item.title, completed: item.is_completed
  }))
  if (memo.status === 'fulfilled') selectedMemo.value = memo.value.data.content || ''
  if (tasks.status === 'rejected' || memo.status === 'rejected') detailError.value = 'タスク・メモの一部を取得できませんでした。'
  detailLoading.value = false
}
function selectDay(date) {
  const api = calendarRef.value?.getApi()
  const currentMonth = api ? api.getDate() : displayedMonth.value
  if (date.getFullYear() !== currentMonth.getFullYear() || date.getMonth() !== currentMonth.getMonth()) {
    api?.gotoDate(date)
  }
  selectedDate.value = new Date(date)
  if (window.matchMedia('(max-width: 700px)').matches) return openDayDetail()
  loadSelectedDateData()
}
function handleCalendarWheel(event) {
  if (wheelLock || Math.abs(event.deltaY) < Math.abs(event.deltaX) || Math.abs(event.deltaY) < 8) return
  event.preventDefault()
  wheelLock = true
  moveMonth(event.deltaY > 0 ? 1 : -1)
  wheelLockTimer = window.setTimeout(() => { wheelLock = false }, 350)
}
function moveMonth(amount) {
  const api = calendarRef.value.getApi()
  amount < 0 ? api.prev() : api.next()
  selectedDate.value = new Date(api.getDate())
  loadSelectedDateData()
}
function jumpMonth(value) {
  if (!/^\d{4}-\d{2}$/.test(value) || !validDate(value + '-01')) return
  selectedDate.value = new Date(value + '-01T00:00:00')
  calendarRef.value.getApi().gotoDate(value + '-01')
  loadSelectedDateData()
}
function goToday() {
  selectedDate.value = new Date()
  calendarRef.value.getApi().today()
  loadSelectedDateData()
}
function openCreateEvent() {
  router.push({ path: '/events/new', query: { date: selectedDateKey.value } })
}
function openFocus(event) {
  router.replace({path:'/calendar',query:{date:selectedDateKey.value,event:event.key}})
}
function closeFocus() {
  router.replace({path:'/calendar',query:{date:selectedDateKey.value}})
}
function handleEventChange({event,deleted,checklistOnly}) {
  const key=event.calendarId+':'+event.id
  const index=events.value.findIndex(item=>item.key===key)
  if(checklistOnly){
    if(index>=0)events.value[index].checklists=event.checklists.map(item=>({
      id:item.checklist_id,title:item.title,completed:item.is_completed,eventId:item.event_id
    }))
    return
  }
  if(deleted) {
    if(index>=0) events.value.splice(index,1)
    return
  }
  const previous=index>=0 ? events.value[index] : null
  const mapped={...mapEvent({
    ...event,
    calendarColor:event.calendarColor || previous?.calendarColor,
    calendarForegroundColor:event.calendarForegroundColor || previous?.calendarForegroundColor
  }),checklists:previous?.checklists || []}
  if(index>=0) events.value.splice(index,1,mapped)
  detailEvent.value=mapped
  selectedDate.value=new Date(mapped.allDay?mapped.start.slice(0,10)+'T00:00:00':mapped.start)
  calendarRef.value?.getApi().gotoDate(selectedDate.value)
}
function openDayDetail(event) {
  router.push({ path: '/today', query: { date: selectedDateKey.value, ...(event?.key ? { event: event.key } : {}) } })
}
onMounted(loadSelectedDateData)
watch(() => route.query.date, value => {
  selectedDate.value = validDate(value) ? new Date(value + 'T00:00:00') : new Date()
  calendarRef.value?.getApi().gotoDate(selectedDate.value)
  loadSelectedDateData()
})
watch(() => route.query.event, value => {
  detailEvent.value=events.value.find(event=>event.key===value)||null
})
onBeforeUnmount(() => {
  monthRequest?.abort()
  detailRequest?.abort()
  if (wheelLockTimer) window.clearTimeout(wheelLockTimer)
})
</script>

<style scoped>
.calendar-focus-layout { flex:1; min-height:0; display:grid; grid-template-columns:minmax(210px,22%) minmax(0,1fr); gap:14px; }
.calendar-focus-agenda { min-width:0; min-height:0; overflow:hidden; padding:20px 14px; border:1px solid #cfd8e6; border-radius:18px; background:#fff; box-shadow:0 10px 30px rgba(34,50,71,.07); }
.calendar-focus-agenda h2 { margin:5px 7px 15px; font-size:16px; }
.focus-return { width:100%; margin-bottom:18px; padding:9px; border:0; border-radius:8px; background:#eef2f7; color:#334b6c; cursor:pointer; font-size:11px; font-weight:700; }
.focus-event-list { display:flex; flex-direction:column; gap:5px; max-height:calc(100% - 100px); overflow:auto; }
.focus-event-list button { display:grid; grid-template-columns:38px minmax(0,1fr) auto; align-items:center; gap:7px; padding:11px 8px; border:1px solid transparent; border-radius:9px; background:transparent; color:#58677a; text-align:left; cursor:pointer; }
.focus-event-list button.active { border-color:#315cbb; background:#eaf0fb; color:#243b61; }
.focus-event-list span,.focus-event-list small { font-size:9px; }.focus-event-list strong { overflow:hidden; font-size:11px; text-overflow:ellipsis; white-space:nowrap; }
@media(max-width:1150px){.calendar-focus-layout{grid-template-columns:1fr}.calendar-focus-agenda{min-height:auto}.focus-event-list{flex-direction:row;max-height:none}.focus-event-list button{min-width:190px}.calendar-focus-layout :deep(.event-workspace){min-height:720px}}
.calendar-page { width: 100%; height: 100%; min-height: 0; display: flex; flex-direction: column; color: #243247; }
.calendar-header { min-height: 58px; display: flex; align-items: center; justify-content: space-between; gap: 20px; margin-bottom: 14px; }
.page-label { display: block; margin-bottom: 4px; color: #667892; font-size: 9px; font-weight: 800; letter-spacing: 1.7px; }
.calendar-header h1, .day-panel-header h2 { margin: 0; color: #243247; }
.calendar-header h1 { font-size: 24px; letter-spacing: -0.7px; }
.calendar-actions, .month-navigation { display: flex; align-items: center; gap: 8px; }
.secondary-button, .month-navigation button, .sync-button, .compact-add-button { height: 38px; border-radius: 9px; font-size: 12px; font-weight: 650; cursor: pointer; }
.secondary-button, .month-navigation button { border: 1px solid #d2dae6; background: #fff; color: #526176; }
.secondary-button { padding: 0 14px; }
.month-navigation button { width: 38px; font-size: 20px; }
.sync-button { display: flex; align-items: center; gap: 6px; padding: 0 15px; border: none; background: #315cbb; color: #fff; }
.sync-button:disabled { opacity: .65; }
.spinning { display: inline-block; animation: rotate .7s linear infinite; }
@keyframes rotate { to { transform: rotate(360deg); } }
.calendar-shell { flex: 1; min-height: 0; display: grid; grid-template-columns: minmax(0, 7fr) minmax(300px, 3fr); overflow: hidden; border: 1px solid #cfd8e6; border-radius: 18px; background: #fff; box-shadow: 0 10px 30px rgba(34,50,71,.09); }
.month-panel { min-width: 0; min-height: 0; display: flex; flex-direction: column; border-right: 1px solid #dfe5ed; }
.weekday-row, .month-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); }
.weekday-row { flex: 0 0 38px; align-items: center; border-bottom: 1px solid #dfe5ed; background: #f4f6f9; color: #68768a; font-size: 10px; font-weight: 700; text-align: center; }
.weekday-row span:first-child { color: #c45151; }
.weekday-row span:last-child { color: #315cbb; }
.month-grid { flex: 1; min-height: 0; grid-template-rows: repeat(6, minmax(0, 1fr)); }
.day-cell { position: relative; min-width: 0; min-height: 0; padding: 8px; overflow: hidden; border: none; border-right: 1px solid #e6eaf0; border-bottom: 1px solid #e6eaf0; background: #fff; color: #2f3c50; text-align: left; cursor: pointer; }
.day-cell:nth-child(7n) { border-right: none; }
.day-cell:hover { background: #f3f5f8; }
.day-cell.muted { background: #f8f9fb; color: #a7b0bd; }
.day-cell.selected { background: #e9eef7; box-shadow: inset 0 0 0 2px #315cbb; }
.day-number { width: 25px; height: 25px; display: inline-flex; align-items: center; justify-content: center; border-radius: 50%; font-size: 11px; font-weight: 700; }
.day-cell.today .day-number { background: #273c5c; color: #fff; }
.cell-events { display: flex; flex-direction: column; gap: 3px; margin-top: 4px; }
.cell-event { overflow: hidden; padding: 3px 5px; border-left: 3px solid #315cbb; border-radius: 3px; background: #edf1f7; color: #35445b; font-size: 9px; line-height: 1.25; text-overflow: ellipsis; white-space: nowrap; }
.cell-event.all-day { border-left-color: #16856b; background: #edf5f2; }
.cell-event b { margin-right: 3px; color: #315cbb; }
.more-events { padding-left: 5px; color: #69778c; font-size: 9px; font-weight: 700; }
.mobile-event-dot { display: none; }
.calendar-loading { flex: 1; display: grid; place-items: center; color: #7d8999; font-size: 12px; }
.day-panel { min-width: 0; min-height: 0; display: flex; flex-direction: column; padding: 24px; }
.day-panel-header { display: flex; align-items: center; justify-content: space-between; }
.day-panel-header h2 { font-size: 18px; letter-spacing: -.4px; }
.compact-add-button { width: 38px; border: none; background: #315cbb; color: #fff; font-size: 20px; }
.day-summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px; margin: 17px 0; padding: 10px; border-radius: 10px; background: #eef1f5; }
.day-summary span { color: #738095; font-size: 9px; text-align: center; }
.day-summary b, .day-summary .active { color: #273c5c; }
.day-panel-content { flex: 1; min-height: 0; overflow: auto; }
.detail-section { margin-bottom: 22px; }
.detail-section h3 { margin: 0 0 9px; color: #526176; font-size: 10px; letter-spacing: .06em; }
.detail-event { width: 100%; display: grid; grid-template-columns: 42px minmax(0,1fr) auto 12px; align-items: center; gap: 9px; padding: 10px 5px 10px 9px; border: none; border-left: 3px solid var(--event-color,#315cbb); border-bottom: 1px solid #e8ebf0; background: transparent; color: #2f3c50; text-align: left; cursor: pointer; }
.detail-event:hover { background: #f4f6f9; }
.detail-time { color: #315cbb; font-size: 10px; font-weight: 750; }
.detail-event-body { min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.detail-event-body strong, .detail-event-body small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.detail-event-body strong { font-size: 12px; }
.detail-event-body small { color: #8a95a5; font-size: 9px; }
.event-check-count{padding:3px 6px;border-radius:999px;background:#e8edf5;color:#40536d;font-size:9px;font-weight:800;white-space:nowrap}
.detail-arrow { color: #9aa4b2; font-size: 18px; }
.panel-empty { min-height: 230px; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #8a95a5; text-align: center; }
.empty-icon { margin-bottom: 10px; color: #315cbb; font-size: 28px; }
.panel-empty strong { color: #526176; font-size: 12px; }
.panel-empty span { margin-top: 5px; font-size: 10px; }
.panel-empty button { margin-top: 16px; padding: 8px 11px; border: 1px solid #315cbb; border-radius: 8px; background: #fff; color: #315cbb; font-size: 10px; font-weight: 700; cursor: pointer; }
.detail-section-heading { display: flex; align-items: center; justify-content: space-between; }
.detail-section-heading span { color: #273c5c; font-size: 10px; font-weight: 750; }
.task-progress { height: 4px; overflow: hidden; margin-bottom: 9px; border-radius: 999px; background: #e5e9ef; }
.task-progress span { display: block; height: 100%; background: #16856b; }
.task-preview p { margin: 6px 0; color: #59677b; font-size: 10px; }
.task-preview p.completed { color: #9aa4b2; text-decoration: line-through; }
.detail-button { width: 100%; height: 40px; margin-top: 12px; border: none; border-radius: 9px; background: #273c5c; color: #fff; font-size: 11px; font-weight: 700; cursor: pointer; }
@media (max-width: 1050px) {
  .calendar-page { height: auto; }
  .calendar-shell { grid-template-columns: 1fr; overflow: visible; }
  .month-panel { min-height: 620px; border-right: none; border-bottom: 1px solid #dfe5ed; }
  .day-panel { min-height: 420px; }
}
@media (max-width: 700px) {
  .calendar-header { align-items: flex-start; flex-direction: column; }
  .calendar-actions { width: 100%; }
  .sync-button { margin-left: auto; }
  .month-panel { min-height: 500px; }
  .day-cell { padding: 5px; }
  .cell-events { display: none; }
  .mobile-event-dot { position: absolute; left: 50%; bottom: 7px; width: 5px; height: 5px; display: block; border-radius: 50%; background: #315cbb; }
}

.month-picker input { max-width: 260px; border: 1px solid #cfd8e6; border-radius: 9px; padding: 7px 10px; font-size: 21px; font-weight: 700; color: #273c5c; background: white; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
.month-panel { position: relative; padding: 12px; }
.month-panel :deep(.fc) { flex: 1; min-height: 0; font-size: 12px; --fc-border-color: #e0e5ec; --fc-today-bg-color: #edf5f2; }
.month-panel :deep(.selected-date) { background: #e9eef7; box-shadow: inset 0 0 0 2px #315cbb; }
.month-panel :deep(.fc-event) { cursor: pointer; }
.load-error { padding: 8px; color: #a03232; background: #fff0ed; font-size: 12px; }
.loading-note { position: absolute; z-index: 3; top: 25px; right: 22px; background: #273c5c; color: white; padding: 5px 9px; border-radius: 5px; font-size: 11px; }
@media(max-width:1050px) { .month-panel { height: 620px; } }
</style>
