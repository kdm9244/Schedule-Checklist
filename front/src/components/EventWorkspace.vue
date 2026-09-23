<template>
  <section v-bind="$attrs" class="event-workspace" aria-labelledby="workspace-title">
    <div class="event-workspace-header">
      <WorkspaceSectionHeader eyebrow="EVENT FOCUS" :title="editing ? '予定を編集' : detail?.summary || event.title" heading-id="workspace-title">
        <template #actions>
          <button class="back-button" :disabled="busy" @click="requestClose">一覧へ</button>
          <template v-if="detail && !editing && detail.canEdit">
            <button class="danger-link" @click="confirmDelete=true; error=''">削除</button>
            <button class="primary" @click="beginEdit">編集</button>
          </template>
        </template>
      </WorkspaceSectionHeader>
    </div>

    <div :class="['workspace-body',{'without-checklist':!showChecklist}]" :aria-busy="loading || busy">
      <div v-if="loading" class="loading-state" role="status">予定を読み込んでいます...</div>
      <div v-else-if="!detail" class="loading-state">
        <p class="error" role="alert">{{ error || '予定を読み込めませんでした。' }}</p>
        <button @click="load">再読み込み</button>
      </div>

      <template v-else>
        <article ref="informationPane" class="information-pane workspace-pane-content">
          <p v-if="error" class="error" role="alert">{{ error }}</p>

          <template v-if="!editing">
            <div class="detail-stack">
              <section class="workspace-content-card detail-card">
                <div class="workspace-content-card-header">
                  <div><span>EVENT INFORMATION</span><strong>予定情報</strong></div>
                  <div class="badges">
                    <span>{{ detail.calendarName || 'Google Calendar' }}</span>
                    <span v-if="detail.recurringEventId">繰り返し · この1回</span>
                    <span v-if="!detail.canEdit">閲覧のみ</span>
                  </div>
                </div>
                <dl>
                  <dt>日時</dt><dd>{{ dateSummary }}</dd>
                  <dt v-if="detail.location">場所</dt><dd v-if="detail.location">{{ detail.location }}</dd>
                </dl>
              </section>
              <section class="workspace-content-card description">
                <div class="workspace-content-card-header"><div><span>DESCRIPTION</span><strong>説明</strong></div></div>
                <div class="description-body">
                  <p>{{ description.text || '説明はありません。' }}</p>
                  <ul v-if="description.links.length">
                    <li v-for="link in description.links" :key="link.url">
                      <a :href="link.url" target="_blank" rel="noopener noreferrer">{{ link.text }} ↗</a>
                    </li>
                  </ul>
                </div>
              </section>
              <p v-if="!detail.canEdit" class="notice">この予定は閲覧専用です。</p>
            </div>
          </template>

          <form v-else id="event-workspace-edit" @submit.prevent="save">
            <fieldset :disabled="busy || !!pending">
              <label>予定名 <input v-model="draft.summary" required maxlength="255"></label>
              <label class="check"><input :checked="draft.allDay" type="checkbox" @change="toggleAllDay($event.target.checked)">終日の予定</label>
              <div class="date-fields">
                <label>開始<input v-model="draft.start" :type="draft.allDay ? 'date' : 'datetime-local'" required></label>
                <label>{{ draft.allDay ? '最終日（この日を含む）' : '終了' }}<input v-model="draft.end" :type="draft.allDay ? 'date' : 'datetime-local'" required></label>
              </div>
              <small v-if="!draft.allDay">表示・入力のタイムゾーン: {{ timeZone }}</small>
              <label>場所<input v-model="draft.location" maxlength="255"></label>
              <label>説明<textarea v-model="draft.description" rows="10" maxlength="20000"></textarea></label>
              <small>説明を書き換えた場合はプレーンテキストで保存します。</small>
            </fieldset>
            <div class="edit-actions">
              <button type="button" :disabled="busy || !!pending" @click="cancelEdit">キャンセル</button>
              <button v-if="conflict" type="button" :disabled="busy" @click="reloadAfterConflict">最新の予定を確認</button>
              <button class="primary" type="submit" :disabled="busy || conflict">{{ busy ? '保存中...' : pending ? '同じ内容で再試行' : '変更を保存' }}</button>
            </div>
          </form>

          <section v-if="discardConfirm" class="discard-confirm" role="alert">
            <p>{{ pending ? 'Google 側に反映済みの可能性があります。同じ内容で再試行することをおすすめします。' : '保存していない変更を破棄しますか？' }}</p>
            <div class="actions"><button @click="discardConfirm=false">編集を続ける</button><button @click="discardChanges">{{ discardTarget==='close' ? '破棄して一日の予定へ' : '変更を破棄' }}</button></div>
          </section>
        </article>

        <aside v-if="showChecklist" class="checklist-pane">
          <div class="checklist-heading">
            <div><span class="eyebrow">PREPARATION</span><h3>準備チェックリスト</h3></div>
            <strong>{{ completed }}/{{ checklistItems.length }}</strong>
          </div>
          <progress :value="completed" :max="checklistItems.length || 1"></progress>
          <p v-if="allPrepared" class="checklist-guide">✓ すべて準備できました</p>

          <div v-if="!checklistItems.length" class="empty-checklist">
            <span>✓</span><strong>準備項目はありません</strong>
          </div>
          <div v-else class="checklist-list">
            <div v-for="(item,index) in checklistItems" :key="item.checklist_id"
              class="checklist-row" :draggable="!checklistBusy"
              @dragstart="dragIndex=index" @dragover.prevent @drop.prevent="moveChecklist(dragIndex,index)">
              <input :checked="item.is_completed" type="checkbox" :disabled="item.pending || checklistBusy" @change="setCompleted(item,$event.target.checked)">
              <span :class="{completed:item.is_completed}">{{ item.title }}</span>
              <button :disabled="index===0 || checklistBusy" aria-label="上へ移動" @click="moveChecklist(index,index-1)">↑</button>
              <button :disabled="index===checklistItems.length-1 || checklistBusy" aria-label="下へ移動" @click="moveChecklist(index,index+1)">↓</button>
              <button class="edit-item" :disabled="checklistBusy" aria-label="編集" @click="openChecklistEditor(item)">✎</button>
            </div>
          </div>
          <div class="add-checklist">
            <input ref="checklistInput" v-model="newTitle" maxlength="200" placeholder="準備するものを入力..." :disabled="checklistBusy" @keydown.enter.prevent="addChecklist">
            <button class="primary" :disabled="checklistBusy || !newTitle.trim()" @click="addChecklist">＋ 追加</button>
          </div>
          <p v-if="checklistError" class="error" role="alert">{{ checklistError }}</p>
        </aside>
      </template>
    </div>
  </section>

  <ChecklistEditModal v-if="editingChecklist" :title="editingChecklist.title" :busy="checklistBusy" :error="checklistEditError"
    @close="closeChecklistEditor" @save="saveChecklistEdit" @delete="deleteChecklistEdit" />

  <Teleport to="body">
    <div v-if="confirmDelete" class="modal-backdrop" @click.self="confirmDelete=false" @keydown.esc="confirmDelete=false">
      <section class="delete-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-title">
        <span class="delete-icon">!</span>
        <h3 id="delete-title">この予定を削除しますか？</h3>
        <strong>「{{ detail?.summary }}」</strong>
        <p>Google Calendar からも削除されます。{{ detail?.recurringEventId ? '繰り返し予定のこの1回のみが対象です。' : '' }}</p>
        <small>準備チェックリストは復元に備えて保管し、今日のタスクとメモは残します。</small>
        <div class="modal-actions">
          <button ref="deleteCancel" :disabled="busy || !!pending" @click="confirmDelete=false">キャンセル</button>
          <button class="danger" :disabled="busy" @click="remove">{{ busy ? '削除中...' : pending ? '削除を再試行' : '予定を削除' }}</button>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, nextTick, onMounted, onBeforeUnmount, watch } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router'
import axios from 'axios'
import { API_ORIGIN } from '../utils/http'
import { readableDescription, editDraft, editPayload } from '../utils/eventDetail'
import ChecklistEditModal from './ChecklistEditModal.vue'
import WorkspaceSectionHeader from './WorkspaceSectionHeader.vue'

defineOptions({inheritAttrs:false})

const props=defineProps({event:{type:Object,required:true},showChecklist:{type:Boolean,default:true}})
const emit=defineEmits(['close','changed'])
const detail=ref(null),draft=ref({}),loading=ref(true),busy=ref(false),error=ref('')
const informationPane=ref(null)
const editing=ref(false),confirmDelete=ref(false),discardConfirm=ref(false),discardTarget=ref('view'),pending=ref(null),conflict=ref(false)
const deleteCancel=ref(null)
const newTitle=ref(''),checklistBusy=ref(false),checklistError=ref(''),dragIndex=ref(null)
const checklistInput=ref(null)
const editingChecklist=ref(null),checklistEditError=ref('')
const timeZone=Intl.DateTimeFormat().resolvedOptions().timeZone
const eventApi=axios.create({baseURL:API_ORIGIN+'/api/calendar/event',withCredentials:true})
const api=axios.create({baseURL:API_ORIGIN+'/api',withCredentials:true})
const ids={calendarId:props.event.calendarId,eventId:props.event.id}
let baseline='',request
const checklistItems=computed(()=>detail.value?.checklists || [])
const description=computed(()=>readableDescription(detail.value?.description))
const completed=computed(()=>checklistItems.value.filter(item=>item.is_completed).length)
const allPrepared=computed(()=>checklistItems.value.length>0 && completed.value===checklistItems.value.length)
const dirty=computed(()=>editing.value && JSON.stringify(draft.value)!==baseline)
const targetDate=computed(()=>detail.value?.start.date || detail.value?.start.dateTime?.slice(0,10))
const eventKey=computed(()=>detail.value ? detail.value.calendarId+':'+detail.value.id : props.event.key)
const dateSummary=computed(()=>{
  if(!detail.value)return''
  const d=editDraft(detail.value,'')
  return d.start.replace('T',' ')+' → '+d.end.replace('T',' ')+(d.allDay?'（終日・最終日を含む）':' · '+timeZone)
})
watch(confirmDelete,open=>{if(open)nextTick(()=>deleteCancel.value?.focus())})
async function load(){
  request?.abort();request=new AbortController();loading.value=true;error.value=''
  try{detail.value=(await eventApi.get('',{params:ids,signal:request.signal})).data;await nextTick();if(informationPane.value)informationPane.value.scrollTop=0}
  catch(e){if(!axios.isCancel(e))error.value=e.response?.data?.message||'予定を読み込めませんでした。'}
  finally{loading.value=false}
}
function beginEdit(){draft.value=editDraft(detail.value,description.value.text);baseline=JSON.stringify(draft.value);editing.value=true;error.value='';conflict.value=false}
function toggleAllDay(value){draft.value.allDay=value;if(value){draft.value.start=draft.value.start.slice(0,10);draft.value.end=draft.value.end.slice(0,10)}else{draft.value.start+='T09:00';draft.value.end+='T10:00'}}
function cancelEdit(){if(dirty.value){discardTarget.value='view';discardConfirm.value=true;return}editing.value=false}
function close(){emit('close')}
function requestClose(){if(busy.value||checklistBusy.value)return;if(dirty.value||pending.value){discardTarget.value='close';discardConfirm.value=true;return}close()}
function discardChanges(){
  const shouldClose=discardTarget.value==='close'
  editing.value=false;pending.value=null;conflict.value=false;discardConfirm.value=false;error.value=''
  if(shouldClose)close()
}
function preventLeave(){if(busy.value||dirty.value||pending.value||checklistBusy.value){error.value='処理を完了するか、変更を破棄してから移動してください。';return false}return true}
onBeforeRouteLeave(preventLeave);onBeforeRouteUpdate(preventLeave)
function unload(e){if(!preventLeave()){e.preventDefault();e.returnValue=''}}
function failure(e){const status=e.response?.status;error.value=e.response?.data?.message||'通信を確認して同じ内容で再試行してください。';conflict.value=[404,409,410,412].includes(status);if(status&&status<500)pending.value=null}
async function save(){
  if(busy.value||conflict.value)return
  if(!pending.value){try{pending.value={...ids,...editPayload(draft.value,detail.value,description.value.text),etag:detail.value.etag,operationId:crypto.randomUUID()}}catch(e){error.value=e.message;return}}
  busy.value=true;error.value=''
  try{const {data}=await eventApi.patch('',pending.value);detail.value={...data,checklists:checklistItems.value};pending.value=null;editing.value=false;emit('changed',{event:data,deleted:false})}
  catch(e){failure(e)}finally{busy.value=false}
}
async function remove(){
  if(busy.value)return
  pending.value||={...ids,etag:detail.value.etag};busy.value=true;error.value=''
  try{await eventApi.delete('',{data:pending.value});pending.value=null;emit('changed',{event:props.event,deleted:true});close()}
  catch(e){failure(e);if(conflict.value){confirmDelete.value=false}}finally{busy.value=false}
}
function reloadAfterConflict(){if(dirty.value&&!window.confirm('入力内容を破棄して最新の予定を読み込みますか？'))return;editing.value=false;conflict.value=false;pending.value=null;load()}
function notifyChecklist(){emit('changed',{event:{...props.event,checklists:checklistItems.value},deleted:false,checklistOnly:true})}
async function setCompleted(item,value){
  if(item.pending)return
  const previous=item.is_completed;item.is_completed=value;item.pending=true
  try{await api.patch('/checklists/'+item.checklist_id+'/status',{completed:value});notifyChecklist()}
  catch{item.is_completed=previous;checklistError.value='完了状態を保存できませんでした。'}finally{item.pending=false}
}
async function addChecklist(){
  const title=newTitle.value.trim();if(!title||checklistBusy.value)return
  checklistBusy.value=true;checklistError.value=''
  try{const {data}=await api.post('/checklists',{title,targetDate:targetDate.value,eventId:eventKey.value});detail.value.checklists.push(data);newTitle.value='';notifyChecklist()}
  catch(e){checklistError.value=e.response?.data?.message||'追加できませんでした。'}
  finally{checklistBusy.value=false;await nextTick();checklistInput.value?.focus()}
}
function openChecklistEditor(item){editingChecklist.value=item;checklistEditError.value=''}
function closeChecklistEditor(){if(!checklistBusy.value){editingChecklist.value=null;checklistEditError.value=''}}
async function saveChecklistEdit(title){
  if(!editingChecklist.value||checklistBusy.value)return
  checklistBusy.value=true;checklistEditError.value=''
  try{const {data}=await api.patch('/checklists/'+editingChecklist.value.checklist_id,{title});Object.assign(editingChecklist.value,data);notifyChecklist()}
  catch(e){checklistEditError.value=e.response?.data?.message||'更新できませんでした。'}
  finally{checklistBusy.value=false;if(!checklistEditError.value)closeChecklistEditor()}
}
async function deleteChecklistEdit(){
  if(!editingChecklist.value||checklistBusy.value)return
  const item=editingChecklist.value;checklistBusy.value=true;checklistEditError.value=''
  try{await api.delete('/checklists/'+item.checklist_id);detail.value.checklists.splice(detail.value.checklists.indexOf(item),1);notifyChecklist()}
  catch(e){checklistEditError.value=e.response?.data?.message||'削除できませんでした。'}
  finally{checklistBusy.value=false;if(!checklistEditError.value)closeChecklistEditor()}
}
async function moveChecklist(from,to){
  const list=checklistItems.value
  if(from===null||to<0||to>=list.length||from===to||checklistBusy.value)return
  const eventIds=[...new Set(list.map(item=>item.event_id||eventKey.value))]
  if(eventIds.length>1){checklistError.value='旧形式の項目が混在しているため、順序を変更できません。';return}
  const previous=[...list],[item]=list.splice(from,1);list.splice(to,0,item);dragIndex.value=null;checklistBusy.value=true
  try{await api.put('/checklists/reorder',{ids:list.map(item=>item.checklist_id),date:targetDate.value,eventId:eventIds[0]});notifyChecklist()}
  catch{list.splice(0,list.length,...previous);checklistError.value='順序を保存できませんでした。'}finally{checklistBusy.value=false}
}
onMounted(()=>{load();window.addEventListener('beforeunload',unload)})
onBeforeUnmount(()=>{request?.abort();window.removeEventListener('beforeunload',unload)})
</script>

<style scoped>
.event-workspace{height:100%;min-height:0;display:flex;flex-direction:column;overflow:hidden;color:var(--ui-text)}
.workspace-body.without-checklist{grid-template-columns:minmax(0,1fr)}
.workspace-body.without-checklist .information-pane{border-right:0}
.event-workspace-header{padding:24px 26px 0}.eyebrow{font-size:9px;letter-spacing:1.8px;color:#6e7c91;font-weight:800}
.edit-actions,.actions{display:flex;justify-content:flex-end;gap:8px}.workspace-body{flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,1.55fr) minmax(310px,.85fr)}
.information-pane,.checklist-pane{min-width:0;min-height:0;overflow:auto}.information-pane{border-right:1px solid #dfe5ed}.loading-state{grid-column:1/-1;display:grid;place-items:center;color:#718095}
.detail-stack{display:flex;flex-direction:column;gap:14px}.detail-card .workspace-content-card-header>div:first-child,.description .workspace-content-card-header>div{display:flex;align-items:center;gap:9px}.badges{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:7px}.badges span{padding:5px 9px;border-radius:6px;background:#edf1f6;color:#526176;font-size:10px}
dl{display:grid;grid-template-columns:45px minmax(0,1fr);gap:13px;margin:0;padding:18px 16px;font-size:13px}dt{color:#748095}dd{margin:0;overflow-wrap:anywhere}.description-body{padding:16px}.description p{margin:0;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.8;font-size:13px}.description ul{margin:12px 0 0;padding-left:20px}a{color:#315cbb}
button{border:1px solid #cad3df;border-radius:var(--ui-radius-sm);padding:9px 13px;background:var(--ui-surface);color:#344962;cursor:pointer;font:inherit;font-size:12px}button:focus-visible{outline:none;box-shadow:var(--ui-focus)}button:disabled{opacity:.45;cursor:default}.primary{background:var(--ui-primary);color:#fff;border-color:var(--ui-primary)}.danger-link{color:var(--ui-danger)}.danger{background:var(--ui-danger);color:#fff;border:0}.back-button{white-space:nowrap}
.notice,small{display:block;color:#718095;font-size:11px;line-height:1.7;margin-top:16px}.error,.discard-confirm{background:#fff1ee;color:#942d2d;padding:13px;border-radius:8px;line-height:1.6;font-size:12px}
.discard-confirm{margin-top:22px}.edit-actions{margin-top:22px}
fieldset{margin:0;padding:0;border:0;min-width:0}label{display:flex;flex-direction:column;gap:7px;margin:17px 0;font-size:12px;font-weight:700}input,textarea{box-sizing:border-box;width:100%;min-width:0;padding:10px;border:1px solid #cbd5e1;border-radius:9px;font:inherit;color:var(--ui-text);background:var(--ui-surface);outline:none}input:focus,textarea:focus{border-color:var(--ui-primary);box-shadow:var(--ui-focus)}.check{flex-direction:row;align-items:center}.check input{width:auto}.date-fields{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.checklist-pane{display:flex;flex-direction:column;padding:28px;background:#fbfcfe}.checklist-heading{display:flex;align-items:center;justify-content:space-between}.checklist-heading h3{margin:4px 0 0;font-size:17px}.checklist-heading strong{display:grid;place-items:center;min-width:43px;height:34px;border-radius:17px;background:#273c5c;color:#fff;font-size:12px}progress{width:100%;height:7px;margin-top:18px;accent-color:#16856b}.checklist-guide{color:#758297;font-size:11px}
.empty-checklist{flex:1;min-height:150px;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#7c899b;text-align:center;font-size:11px}.empty-checklist>span{font-size:26px;color:#16856b}
.checklist-list{flex:1;min-height:80px;overflow:auto;margin:10px 0}.checklist-row{display:grid;grid-template-columns:18px minmax(0,1fr) 24px 24px 24px;align-items:center;gap:5px;min-height:42px;border-bottom:1px solid #e3e8ef;font-size:12px}.checklist-row button{padding:3px;border:0;background:transparent}.checklist-row .completed{text-decoration:line-through;color:#8b96a6}.edit-item{color:#315cbb!important}
.add-checklist{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:7px;padding-top:14px;border-top:1px solid #dfe5ed}.add-checklist input{height:39px}.add-checklist button{white-space:nowrap}
@media(max-width:1050px){.workspace-body:not(.without-checklist){grid-template-columns:1fr}.workspace-body:not(.without-checklist) .information-pane{border-right:0;border-bottom:1px solid #dfe5ed;overflow:visible}.event-workspace:has(.workspace-body:not(.without-checklist)){height:auto;overflow:visible}.checklist-pane{min-height:420px}}
@media(max-width:700px){.event-workspace-header{padding:20px 18px 0}.checklist-pane{padding:20px}.date-fields{grid-template-columns:1fr}}
.modal-backdrop{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:20px;background:rgba(18,28,43,.55)}
.delete-modal{width:min(430px,100%);padding:28px;border-radius:18px;background:#fff;box-shadow:0 24px 70px rgba(10,20,35,.28);color:#243247;text-align:center}
.delete-icon{display:grid;place-items:center;width:44px;height:44px;margin:0 auto 14px;border-radius:50%;background:#fff0ed;color:#b53b31;font-size:24px;font-weight:800}
.delete-modal h3{margin:0 0 10px;font-size:21px}.delete-modal>strong{display:block;margin-bottom:12px}.delete-modal p{margin:0 0 10px;color:#526176;font-size:13px;line-height:1.65}.delete-modal small{color:#8290a3;line-height:1.6}
.modal-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:24px}.modal-actions button{padding:11px;border:1px solid #d7deea;border-radius:9px;background:#fff;cursor:pointer;font-weight:700}.modal-actions .danger{border-color:#b84035;background:#b84035;color:#fff}
</style>
