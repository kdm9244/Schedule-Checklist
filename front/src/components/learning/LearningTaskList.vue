<template>
 <div class="learning-task-list polished-tasks" :class="{'learning-task-grid':!taskId,'task-detail-controls':!!taskId}">
  <div v-if="!taskId" class="task-list-toolbar"><div class="section-title-group"><h2>やること</h2><span class="section-count">{{ tasks.length }}</span><small>{{ tasks.filter(t=>t.is_completed).length }} / {{ tasks.length }} 完了</small></div><button class="primary" @click="modal={task:null,move:false}">＋ やることを追加</button></div>
  <p v-if="!tasks.length" class="learning-empty-small">最初のやることを追加しましょう。</p>
  <article v-for="task in tasks" :key="task.task_id" class="learning-task" :class="{'task-done':task.is_completed}">
   <div v-if="!taskId" class="task-card-top"><span class="task-status">{{ task.is_completed?'✓ 完了':'学習中' }}</span><div class="task-menu"><button type="button" aria-label="タスクの操作" :aria-expanded="openMenu===task.task_id" @click="openMenu=openMenu===task.task_id?null:task.task_id" @keydown.esc="openMenu=null">⋯</button><div v-if="openMenu===task.task_id" class="task-menu-items"><button @click="modal={task,move:false};openMenu=null">編集</button><button @click="modal={task,move:true};openMenu=null">別の小さな目標へ移動</button><button class="danger" :disabled="state.busy" @click="openMenu=null;deleteTask(task)">削除</button></div></div></div>
   <div class="learning-task-main"><input type="checkbox" :checked="task.is_completed" :disabled="state.busy" :aria-label="task.title+'の完了'" @change="run(()=>save('tasks',task.task_id,{is_completed:$event.target.checked}))" /><input v-if="editing===task.task_id" v-model="editTitle" maxlength="200" aria-label="タスク名" @keydown.enter="updateTitle(task)" @keydown.esc="editing=null" /><span v-else-if="taskId" class="task-completion-label">{{ task.is_completed?'完了済み':'完了にする' }}</span><RouterLink v-else :to="'/learning/tasks/'+task.task_id" class="learning-task-title" :class="{completed:task.is_completed}">{{ task.title }}</RouterLink></div>
   <div v-if="taskId && editing!==task.task_id" class="task-detail-edit"><button class="quiet" @click="editing=task.task_id;editTitle=task.title">名前を編集</button><button class="quiet danger" :disabled="state.busy" @click="deleteTask(task)">削除</button></div><div v-if="editing===task.task_id" class="task-edit-actions"><button :disabled="state.busy" @click="updateTitle(task)">保存</button><button @click="editing=null">キャンセル</button></div>
   <div class="task-next-date"><span>学習期間</span><strong>{{ task.start_date || '未設定' }} 〜 {{ task.target_date || '未設定' }}</strong></div>
   <div class="task-card-footer"><RouterLink v-if="!taskId" class="learning-button" :to="'/learning/tasks/'+task.task_id">詳細を見る →</RouterLink><button class="quiet" :aria-expanded="!!openSchedules[task.task_id]" @click="openSchedules[task.task_id]=!openSchedules[task.task_id]">{{ openSchedules[task.task_id]?'閉じる':'＋ 学習予定' }}</button></div>
   <div v-if="openSchedules[task.task_id]" class="learning-task-schedules"><span class="learning-muted">学習予定を管理</span><div v-for="s in schedulesFor(task)" :key="s.schedule_id" class="learning-date-chip"><input type="date" :value="s.scheduled_date" :disabled="state.busy" aria-label="学習予定日" @change="changeDate(s,$event.target.value)" /><RouterLink :to="{path:'/calendar',query:{date:s.scheduled_date}}" title="カレンダーで確認">↗</RouterLink><button :disabled="state.busy" aria-label="学習予定を削除" @click="deleteSchedule(s)">×</button></div><input v-model="newDates[task.task_id]" type="date" aria-label="新しい学習予定日" /><button :disabled="state.busy" @click="addSchedule(task)">追加</button></div>
  </article>
  <LearningTaskModal v-if="modal" :milestone-id="milestoneId" :task="modal.task" :move="modal.move" @close="modal=null" @saved="modal=null" /><p v-if="error" class="learning-error" role="alert">{{ error }}</p>
 </div>
</template>
<script setup>
import {computed,reactive,ref} from 'vue'
import {useLearning,learningError} from '../../composables/useLearning'
import {dateKey,validDate} from '../../utils/calendar'
import LearningTaskModal from './LearningTaskModal.vue'
const modal=ref(null)
const props=defineProps({milestoneId:{type:String,required:true},taskId:String})
const {state,save,remove}=useLearning()
const tasks=computed(()=>state.tasks.filter(t=>t.milestone_id===props.milestoneId&&(!props.taskId||t.task_id===props.taskId)).sort((a,b)=>a.sort_order-b.sort_order||Number(a.task_id)-Number(b.task_id)))
const title=ref(''),error=ref(''),editing=ref(null),editTitle=ref(''),newDates=reactive({}),openSchedules=reactive({}),openMenu=ref(null)
const schedulesFor=task=>state.schedules.filter(s=>s.task_id===task.task_id).sort((a,b)=>a.scheduled_date.localeCompare(b.scheduled_date))
const nextDate=task=>schedulesFor(task).find(s=>s.scheduled_date>=dateKey(new Date()))?.scheduled_date
async function run(action){error.value='';try{await action()}catch(e){error.value=learningError(e)}}
function addTask(){run(async()=>{if(!title.value.trim())throw new Error('タスク名を入力してください。');await save('tasks',null,{milestone_id:props.milestoneId,title:title.value});title.value=''})}
function updateTitle(task){run(async()=>{if(!editTitle.value.trim())throw new Error('タスク名を入力してください。');await save('tasks',task.task_id,{title:editTitle.value});editing.value=null})}
function addSchedule(task){run(async()=>{const date=newDates[task.task_id];if(!validDate(date))throw new Error('学習予定日を選択してください。');await save('schedules',null,{task_id:task.task_id,scheduled_date:date});newDates[task.task_id]=''})}
function changeDate(s,date){run(async()=>{if(!validDate(date))throw new Error('日付を選択してください。');await save('schedules',s.schedule_id,{scheduled_date:date})})}
function deleteTask(task){const count=schedulesFor(task).length;if(window.confirm(`「${task.title}」と学習予定${count}件を削除します。学習記録は保存され、タスクの関連付けだけ解除されます。`))run(()=>remove('tasks',task.task_id))}
function deleteSchedule(s){if(window.confirm('この学習予定を削除しますか？タスクと学習記録は保存されます。'))run(()=>remove('schedules',s.schedule_id))}
</script>
