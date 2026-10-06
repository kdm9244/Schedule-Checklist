<template>
  <div class="learning-task-list">
    <p v-if="!tasks.length" class="learning-empty-small">タスクを追加すると、進捗を確認できます。</p>
    <div v-for="task in tasks" :key="task.task_id" class="learning-task">
      <div class="learning-task-main"><input type="checkbox" :checked="task.is_completed" :disabled="state.busy" :aria-label="task.title+'の完了'" @change="run(()=>save('tasks',task.task_id,{is_completed:$event.target.checked}))" />
        <input v-if="editing===task.task_id" v-model="editTitle" maxlength="200" aria-label="タスク名" @keydown.enter="updateTitle(task)" @keydown.esc="editing=null" />
        <RouterLink v-else :to="'/learning/tasks/'+task.task_id" :class="{completed:task.is_completed}" class="learning-task-title">{{ task.title }} <small>詳細を見る →</small></RouterLink>
        <button v-if="editing===task.task_id" :disabled="state.busy" @click="updateTitle(task)">保存</button><button v-else class="quiet" @click="editing=task.task_id;editTitle=task.title">編集</button>
        <button class="quiet danger" :disabled="state.busy" @click="deleteTask(task)">削除</button>
      </div>
      <div class="learning-task-schedules"><span class="learning-muted">学習予定</span><div v-for="s in schedulesFor(task)" :key="s.schedule_id" class="learning-date-chip"><input type="date" :value="s.scheduled_date" :disabled="state.busy" aria-label="学習予定日" @change="changeDate(s,$event.target.value)" /><RouterLink :to="{path:'/calendar',query:{date:s.scheduled_date}}" title="カレンダーで確認">↗</RouterLink><button :disabled="state.busy" aria-label="学習予定を削除" @click="deleteSchedule(s)">×</button></div>
        <input v-model="newDates[task.task_id]" type="date" aria-label="新しい学習予定日" /><button :disabled="state.busy" @click="addSchedule(task)">＋ 予定</button>
      </div>
    </div>
    <form v-if="!taskId" class="learning-inline-form" @submit.prevent="addTask"><input v-model="title" required maxlength="200" placeholder="次にやることを追加" aria-label="新しいタスク" /><button class="primary" :disabled="state.busy">＋ タスク</button></form>
    <p v-if="error" class="learning-error" role="alert">{{ error }}</p>
  </div>
</template>
<script setup>
import {computed,reactive,ref} from 'vue'
import {useLearning,learningError} from '../../composables/useLearning'
import {validDate} from '../../utils/calendar'
const props=defineProps({milestoneId:{type:String,required:true},taskId:String})
const {state,save,remove}=useLearning()
const tasks=computed(()=>state.tasks.filter(t=>t.milestone_id===props.milestoneId&&(!props.taskId||t.task_id===props.taskId)).sort((a,b)=>a.sort_order-b.sort_order||Number(a.task_id)-Number(b.task_id)))
const title=ref(''),error=ref(''),editing=ref(null),editTitle=ref(''),newDates=reactive({})
const schedulesFor=task=>state.schedules.filter(s=>s.task_id===task.task_id).sort((a,b)=>a.scheduled_date.localeCompare(b.scheduled_date))
async function run(action){error.value='';try{await action()}catch(e){error.value=learningError(e)}}
function addTask(){run(async()=>{if(!title.value.trim())throw new Error('タスク名を入力してください。');await save('tasks',null,{milestone_id:props.milestoneId,title:title.value});title.value=''})}
function updateTitle(task){run(async()=>{if(!editTitle.value.trim())throw new Error('タスク名を入力してください。');await save('tasks',task.task_id,{title:editTitle.value});editing.value=null})}
function addSchedule(task){run(async()=>{const date=newDates[task.task_id];if(!validDate(date))throw new Error('学習予定日を選択してください。');await save('schedules',null,{task_id:task.task_id,scheduled_date:date});newDates[task.task_id]=''})}
function changeDate(s,date){run(async()=>{if(!validDate(date))throw new Error('日付を選択してください。');await save('schedules',s.schedule_id,{scheduled_date:date})})}
function deleteTask(task){const count=schedulesFor(task).length;if(window.confirm(`「${task.title}」と学習予定${count}件を削除します。学習記録は保存され、タスクの関連付けだけ解除されます。`))run(()=>remove('tasks',task.task_id))}
function deleteSchedule(s){if(window.confirm('この学習予定を削除しますか？タスクと学習記録は保存されます。'))run(()=>remove('schedules',s.schedule_id))}
</script>
