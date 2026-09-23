<template>
  <div class="settings-page">
    <header class="settings-header">
      <div><span>SETTINGS</span><h1>設定</h1></div>
    </header>

    <nav class="settings-tabs" aria-label="設定カテゴリー">
      <button :class="{active:activeTab==='templates'}" @click="activeTab='templates'">繰り返しチェックリスト</button>
      <button :class="{active:activeTab==='calendars'}" @click="activeTab='calendars'">表示カレンダー <span v-if="calendarsLoaded">{{ visibleCalendarCount }}</span></button>
    </nav>

    <main v-if="activeTab==='templates'" class="settings-layout">
      <section class="template-form">
        <div class="section-heading"><span>TEMPLATE</span><h2>{{ editingId ? '設定を編集' : '新しい設定' }}</h2></div>
        <label>チェックリスト名<input v-model="title" maxlength="200" placeholder="例：業務日報を書く" @keydown.enter.prevent="save"></label>
        <div class="preset-row"><button v-for="preset in presets" :key="preset.label" :class="{active:sameDays(preset.days)}" @click="days=[...preset.days]">{{ preset.label }}</button></div>
        <fieldset><legend>曜日を選択</legend><div class="day-selector">
          <label v-for="day in weekdays" :key="day.value" :class="{selected:days.includes(day.value)}"><input v-model="days" type="checkbox" :value="day.value"><span>{{ day.label }}</span></label>
        </div></fieldset>
        <fieldset class="start-fieldset"><legend>適用開始日</legend>
          <div class="start-options">
            <label :class="{selected:startMode==='today'}"><input v-model="startMode" type="radio" value="today"><span><b>今日から</b><small>{{ todayKey }}</small></span></label>
            <label :class="{selected:startMode==='custom'}"><input v-model="startMode" type="radio" value="custom"><span><b>日付を指定</b><small>開始日を選択</small></span></label>
          </div>
          <label v-if="startMode==='custom'" class="start-date-label">開始日<input v-model="startDate" type="date" :min="todayKey"></label>
        </fieldset>
        <p class="rule-preview">{{ effectiveStartDate }}から{{ daysLabel(days) }}に自動で追加されます。</p>
        <p v-if="templateError" class="error" role="alert">{{ templateError }}</p>
        <div class="form-actions"><button v-if="editingId" @click="resetForm">キャンセル</button><button class="primary" :disabled="saving || !title.trim() || !days.length || !startDateValid" @click="save">{{ saving ? '保存中...' : editingId ? '変更を保存' : '設定を追加' }}</button></div>
      </section>

      <section class="template-list">
        <div class="section-heading"><span>ACTIVE RULES</span><h2>自動で追加する項目</h2></div>
        <div v-if="loading" class="empty">読み込み中...</div>
        <div v-else-if="!templates.length" class="empty"><strong>まだ設定がありません</strong><p>毎日確認するタスクを左のフォームから追加できます。</p></div>
        <article v-for="item in templates" :key="item.template_id" :class="{disabled:!item.is_active}">
          <div class="template-copy"><strong>{{ item.title }}</strong><span>{{ daysLabel(item.days_of_week) }} · {{ item.start_date }}から</span></div>
          <label class="switch"><input type="checkbox" :checked="item.is_active" @change="toggle(item,$event.target.checked)"><span></span><b>{{ item.is_active ? '有効' : '停止中' }}</b></label>
          <div class="card-actions"><button @click="edit(item)">編集</button><button class="delete" @click="remove(item)">削除</button></div>
        </article>
      </section>
    </main>

    <main v-else class="calendar-settings-card">
      <div class="calendar-settings-heading">
        <div><span>DISPLAY CALENDARS</span><h2>表示する予定</h2><p>Google側の予定は変更されません。</p></div>
        <strong v-if="calendarsLoaded">{{ visibleCalendarCount }}/{{ calendars.length }} 表示中</strong>
      </div>
      <p v-if="calendarError" class="error" role="alert">{{ calendarError }} <button @click="loadCalendars">再試行</button></p>
      <div v-if="calendarLoading" class="empty calendar-loading">カレンダーを読み込んでいます...</div>
      <div v-else class="calendar-groups">
        <section v-for="group in calendarGroups" :key="group.key" class="calendar-group">
          <div class="calendar-group-title"><div><span>{{ group.label }}</span><small>{{ group.items.length }}</small></div><p>{{ group.description }}</p></div>
          <div v-if="!group.items.length" class="group-empty">該当するカレンダーはありません。</div>
          <label v-for="calendar in group.items" :key="calendar.id" :class="['calendar-row',{disabled:pendingCalendarIds.has(calendar.id)}]">
            <input type="checkbox" :checked="calendar.visible" :disabled="pendingCalendarIds.has(calendar.id)" @change="setCalendarVisibility(calendar,$event.target.checked)">
            <span class="calendar-check" :style="{backgroundColor:calendar.visible?calendar.color:'#fff',borderColor:calendar.color}">{{ calendar.visible ? '✓' : '' }}</span>
            <span class="calendar-color" :style="{backgroundColor:calendar.color}"></span>
            <span class="calendar-copy"><strong>{{ calendar.summary }}</strong><small>{{ calendar.primary ? 'メインカレンダー' : calendar.accessRole === 'owner' ? '自分が所有' : '共有・購読カレンダー' }}</small></span>
            <span class="visibility-state">{{ calendar.visible ? '表示' : '非表示' }}</span>
          </label>
        </section>
      </div>
    </main>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import axios from 'axios'
import { API_ORIGIN } from '../utils/http'
import { dateKey } from '../utils/calendar'

const templateApi=axios.create({baseURL:API_ORIGIN+'/api/checklist-templates',withCredentials:true})
const calendarApi=axios.create({baseURL:API_ORIGIN+'/api/calendar',withCredentials:true})
const activeTab=ref('templates')
const weekdays=[{value:1,label:'月'},{value:2,label:'火'},{value:3,label:'水'},{value:4,label:'木'},{value:5,label:'金'},{value:6,label:'土'},{value:0,label:'日'}]
const presets=[{label:'毎日',days:[0,1,2,3,4,5,6]},{label:'平日',days:[1,2,3,4,5]},{label:'週末',days:[0,6]}]
const templates=ref([]),loading=ref(true),saving=ref(false),templateError=ref('')
const editingId=ref(null),title=ref(''),days=ref([1,2,3,4,5])
const todayKey=dateKey(new Date()),startMode=ref('today'),startDate=ref(todayKey)
const effectiveStartDate=computed(()=>startMode.value==='today'?todayKey:startDate.value)
const startDateValid=computed(()=>startMode.value==='today'||(startDate.value&&startDate.value>=todayKey))
const calendars=ref([]),calendarLoading=ref(false),calendarError=ref(''),calendarsLoaded=ref(false),pendingCalendarIds=ref(new Set())
const visibleCalendarCount=computed(()=>calendars.value.filter(item=>item.visible).length)
const calendarGroups=computed(()=>[
  {key:'owned',label:'マイカレンダー',description:'自分が所有するカレンダー',items:calendars.value.filter(item=>item.owned)},
  {key:'other',label:'他のカレンダー',description:'共有または購読しているカレンダー',items:calendars.value.filter(item=>!item.owned)}
])
const sorted=value=>[...value].sort((a,b)=>a-b)
const sameDays=value=>JSON.stringify(sorted(days.value))===JSON.stringify(sorted(value))
function daysLabel(value){
  if(JSON.stringify(sorted(value))===JSON.stringify([0,1,2,3,4,5,6]))return'毎日'
  if(JSON.stringify(sorted(value))===JSON.stringify([1,2,3,4,5]))return'平日'
  if(JSON.stringify(sorted(value))===JSON.stringify([0,6]))return'週末'
  return weekdays.filter(day=>value.includes(day.value)).map(day=>day.label).join('・')+'曜日'
}
async function load(){loading.value=true;templateError.value='';try{templates.value=(await templateApi.get('/')).data}catch(e){templateError.value=e.response?.data?.message||'設定を読み込めませんでした。'}finally{loading.value=false}}
function resetForm(){editingId.value=null;title.value='';days.value=[1,2,3,4,5];startMode.value='today';startDate.value=todayKey;templateError.value=''}
function edit(item){editingId.value=item.template_id;title.value=item.title;days.value=[...item.days_of_week];startMode.value='today';startDate.value=todayKey;templateError.value='';window.scrollTo({top:0,behavior:'smooth'})}
async function save(){if(saving.value||!title.value.trim()||!days.value.length||!startDateValid.value)return;saving.value=true;templateError.value='';try{const payload={title:title.value.trim(),daysOfWeek:days.value.map(Number),startDate:effectiveStartDate.value};if(editingId.value)await templateApi.patch('/'+editingId.value,payload);else await templateApi.post('/',payload);resetForm();await load()}catch(e){templateError.value=e.response?.data?.message||'設定を保存できませんでした。'}finally{saving.value=false}}
async function toggle(item,active){const previous=item.is_active;item.is_active=active;try{await templateApi.patch('/'+item.template_id,{active})}catch(e){item.is_active=previous;templateError.value=e.response?.data?.message||'状態を変更できませんでした。'}}
async function remove(item){if(!window.confirm(`「${item.title}」の自動追加を削除しますか？\n今日以降に自動生成された項目も削除されます。過去の記録は残ります。`))return;try{await templateApi.delete('/'+item.template_id);templates.value=templates.value.filter(row=>row.template_id!==item.template_id);if(editingId.value===item.template_id)resetForm()}catch(e){templateError.value=e.response?.data?.message||'削除できませんでした。'}}
async function loadCalendars(){if(calendarLoading.value)return;calendarLoading.value=true;calendarError.value='';try{calendars.value=(await calendarApi.get('/calendars')).data;calendarsLoaded.value=true}catch(e){calendarError.value=e.response?.data?.message||'カレンダー一覧を読み込めませんでした。'}finally{calendarLoading.value=false}}
async function setCalendarVisibility(calendar,visible){if(pendingCalendarIds.value.has(calendar.id))return;const previous=calendar.visible;calendar.visible=visible;pendingCalendarIds.value=new Set([...pendingCalendarIds.value,calendar.id]);calendarError.value='';try{await calendarApi.put('/calendars/visibility',{calendarId:calendar.id,visible})}catch(e){calendar.visible=previous;calendarError.value=e.response?.data?.message||'表示設定を保存できませんでした。'}finally{const next=new Set(pendingCalendarIds.value);next.delete(calendar.id);pendingCalendarIds.value=next}}
watch(activeTab,value=>{if(value==='calendars'&&!calendarsLoaded.value)loadCalendars()})
onMounted(load)
</script>

<style scoped>
.settings-page{height:100%;min-height:0;display:flex;flex-direction:column;color:#243247}.settings-header{margin-bottom:14px}.settings-header span,.section-heading span,.calendar-settings-heading>div>span{color:#667892;font-size:9px;font-weight:800;letter-spacing:.16em}.settings-header h1{margin:5px 0 6px;font-size:25px}.settings-header p,.calendar-settings-heading p{margin:0;color:#718096;font-size:12px}.settings-tabs{display:flex;gap:5px;margin-bottom:12px;padding:4px;border:1px solid #d7deea;border-radius:11px;background:#e5e9f0;align-self:flex-start}.settings-tabs button{min-height:34px;padding:0 14px;border:0;border-radius:8px;background:transparent;color:#617086;font-size:11px;font-weight:700;cursor:pointer}.settings-tabs button.active{background:#fff;color:#294f9d;box-shadow:0 2px 7px rgba(34,50,71,.1)}.settings-tabs button span{display:inline-grid;min-width:18px;height:18px;margin-left:5px;place-items:center;border-radius:999px;background:#e9eef9;font-size:9px}.settings-layout{flex:1;min-height:0;display:grid;grid-template-columns:minmax(360px,.85fr) minmax(420px,1.15fr);border:1px solid #cfd8e6;border-radius:18px;background:#fff;box-shadow:0 10px 30px rgba(34,50,71,.08);overflow:hidden}.template-form,.template-list{min-width:0;padding:22px}.template-form{overflow:hidden;border-right:1px solid #e2e7ef;background:#f8f9fb}.template-list{overflow:auto}.section-heading h2{margin:5px 0 14px;font-size:19px}.template-form>label{display:flex;flex-direction:column;gap:7px;font-size:11px;font-weight:700}.template-form input[type=text],.template-form>label input{height:40px;padding:0 12px;border:1px solid #cfd8e6;border-radius:9px;background:#fff;font:inherit}.preset-row{display:flex;gap:7px;margin:12px 0}.preset-row button{padding:7px 14px;border:1px solid #cfd8e6;border-radius:999px;background:#fff;color:#56657a;cursor:pointer}.preset-row button.active{border-color:#315cbb;background:#315cbb;color:#fff}.template-form fieldset{margin:0;padding:0;border:0}.template-form legend{margin-bottom:7px;font-size:11px;font-weight:700}.day-selector{display:grid;grid-template-columns:repeat(7,1fr);gap:6px}.day-selector label{cursor:pointer}.day-selector input,.start-options input,.calendar-row>input{position:absolute;opacity:0}.day-selector span{display:grid;place-items:center;height:36px;border:1px solid #d5dce7;border-radius:9px;background:#fff;color:#607087;font-size:11px;font-weight:700}.day-selector label.selected span{border-color:#315cbb;background:#e9eef9;color:#294f9d}.start-fieldset{margin-top:14px!important}.start-options{display:grid;grid-template-columns:1fr 1fr;gap:8px}.start-options label{cursor:pointer}.start-options span{display:flex;min-height:44px;flex-direction:column;justify-content:center;gap:3px;padding:0 12px;border:1px solid #d5dce7;border-radius:9px;background:#fff}.start-options label.selected span{border-color:#315cbb;background:#e9eef9;color:#294f9d}.start-options b{font-size:11px}.start-options small{color:#78869a;font-size:9px}.start-date-label{display:flex;margin-top:8px;flex-direction:column;gap:6px;color:#536278;font-size:10px;font-weight:700}.start-date-label input{height:36px;padding:0 11px;border:1px solid #cfd8e6;border-radius:9px;background:#fff;color:#243247}.rule-preview{margin:10px 0 0;padding:9px 11px;border-left:3px solid #315cbb;border-radius:6px;background:#eef3ff;color:#294f9d;font-size:10px;font-weight:700}.error{padding:10px;border-radius:8px;background:#fff0ed;color:#a23a31;font-size:11px}.error button{margin-left:8px;border:0;background:transparent;color:inherit;font-weight:800;cursor:pointer}.form-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:10px}.form-actions button,.card-actions button{padding:9px 13px;border:1px solid #d3dae5;border-radius:8px;background:#fff;cursor:pointer}.form-actions .primary{border-color:#315cbb;background:#315cbb;color:#fff}.form-actions button:disabled{opacity:.45}.template-list article{display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:center;gap:16px;padding:17px 4px;border-bottom:1px solid #e7ebf1}.template-list article.disabled{opacity:.58}.template-copy{display:flex;min-width:0;flex-direction:column;gap:5px}.template-copy strong{overflow:hidden;font-size:13px;text-overflow:ellipsis;white-space:nowrap}.template-copy span{color:#718096;font-size:10px}.switch{display:flex;align-items:center;gap:7px;cursor:pointer}.switch input{position:absolute;opacity:0}.switch span{position:relative;width:34px;height:19px;border-radius:999px;background:#bec7d4}.switch span:after{content:'';position:absolute;top:3px;left:3px;width:13px;height:13px;border-radius:50%;background:#fff;transition:.18s}.switch input:checked+span{background:#16856b}.switch input:checked+span:after{transform:translateX(15px)}.switch b{font-size:9px}.card-actions{display:flex;gap:5px}.card-actions button{padding:7px 9px;font-size:10px}.card-actions .delete{color:#ad3b32}.empty{display:grid;place-items:center;min-height:180px;color:#8996a8;text-align:center}.empty p{font-size:11px}
.calendar-settings-card{flex:1;min-height:0;padding:28px;border:1px solid #cfd8e6;border-radius:18px;background:#fff;box-shadow:0 10px 30px rgba(34,50,71,.08);overflow:auto}.calendar-settings-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:24px;padding-bottom:22px;border-bottom:1px solid #e3e8ef}.calendar-settings-heading h2{margin:5px 0 7px;font-size:20px}.calendar-settings-heading strong{flex:0 0 auto;padding:8px 11px;border-radius:999px;background:#eef3ff;color:#315cbb;font-size:10px}.calendar-loading{min-height:320px}.calendar-groups{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:22px;margin-top:22px}.calendar-group{overflow:hidden;border:1px solid #dde4ee;border-radius:14px}.calendar-group-title{padding:15px 16px;background:#f6f8fb;border-bottom:1px solid #e4e9f0}.calendar-group-title>div{display:flex;align-items:center;gap:8px}.calendar-group-title span{font-size:12px;font-weight:800}.calendar-group-title small{display:grid;min-width:20px;height:20px;place-items:center;border-radius:999px;background:#e6ebf3;color:#66758a;font-size:9px}.calendar-group-title p{margin:5px 0 0;color:#8a96a7;font-size:9px}.calendar-row{display:grid;grid-template-columns:20px 9px minmax(0,1fr) auto;align-items:center;gap:10px;min-height:58px;padding:0 15px;border-bottom:1px solid #edf0f4;cursor:pointer}.calendar-row:last-child{border-bottom:0}.calendar-row:hover{background:#fafbfc}.calendar-row.disabled{opacity:.55;cursor:wait}.calendar-check{display:grid;width:18px;height:18px;place-items:center;border:2px solid;border-radius:4px;color:#fff;font-size:11px;font-weight:900}.calendar-color{width:8px;height:8px;border-radius:50%}.calendar-copy{display:flex;min-width:0;flex-direction:column;gap:4px}.calendar-copy strong{overflow:hidden;font-size:12px;text-overflow:ellipsis;white-space:nowrap}.calendar-copy small{color:#8995a6;font-size:9px}.visibility-state{color:#77869a;font-size:9px}.group-empty{padding:30px 16px;color:#929dad;font-size:10px;text-align:center}
@media(max-width:900px){.settings-page{height:auto}.settings-layout{grid-template-columns:1fr;overflow:visible}.template-form,.template-list{overflow:visible}.template-form{border-right:0;border-bottom:1px solid #e2e7ef}.calendar-groups{grid-template-columns:1fr}.calendar-settings-card{overflow:visible}}
@media(max-width:560px){.settings-header h1{font-size:21px}.settings-tabs{width:100%;box-sizing:border-box}.settings-tabs button{flex:1;padding:0 7px}.template-form,.template-list,.calendar-settings-card{padding:20px 16px}.day-selector{gap:3px}.start-options{grid-template-columns:1fr}.template-list article{grid-template-columns:1fr auto}.card-actions{grid-column:1/3;justify-content:flex-end}.calendar-settings-heading{flex-direction:column}.calendar-row{padding:0 10px}}
</style>
