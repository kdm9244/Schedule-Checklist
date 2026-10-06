<template>
  <div class="learning learning-calendar-section">
    <div class="learning-section-heading"><h3>この日の学習</h3><RouterLink class="learning-button" :to="{path:'/learning/records/new',query:{date}}">＋ 記録</RouterLink></div>
    <RouterLink v-for="r in roadmaps" :key="r.roadmap_id" class="learning-calendar-deadline" :to="'/learning/roadmaps/'+r.roadmap_id">ロードマップ · {{ r.title }}（{{ r.start_date }} 〜 {{ r.target_date }}） →</RouterLink>
    <p v-if="!sessions.length&&!records.length&&!deadlines.length&&!roadmaps.length" class="learning-empty-small">学習予定・記録はありません。記録はマイルストーン未指定でも保存できます。</p>
    <h3 v-if="deadlines.length">マイルストーンの締切</h3><RouterLink v-for="m in deadlines" :key="m.milestone_id" class="learning-calendar-deadline" :to="'/learning/milestones/'+m.milestone_id">締切 · {{ m.title }} →</RouterLink>
    <h3 v-if="sessions.length">学習予定</h3><div v-for="s in sessions" :key="s.schedule_id" class="learning-calendar-session"><label><input type="checkbox" :checked="task(s)?.is_completed" :disabled="state.busy" @change="toggleTask(task(s),$event.target.checked)" /><strong :class="{completed:task(s)?.is_completed}">{{ task(s)?.title }}</strong></label><div class="learning-calendar-session-links"><RouterLink :to="'/learning/milestones/'+milestone(s)?.milestone_id">{{ milestone(s)?.title }} ↗</RouterLink><RouterLink :to="{path:'/learning/records/new',query:{date,milestone:task(s)?.milestone_id,task:s.task_id}}">記録を書く</RouterLink><input type="date" :value="s.scheduled_date" :disabled="state.busy" aria-label="学習予定日を変更" @change="moveSession(s,$event.target.value)" /><button class="quiet danger" :disabled="state.busy" @click="deleteSession(s)">削除</button></div></div>
    <h3 v-if="records.length">学習記録 · {{ records.length }}件</h3><LearningRecordList :records="records" /><p v-if="error" class="learning-error" role="alert">{{ error }}</p>
  </div>
</template>
<script setup>
import {computed,ref} from 'vue'
import {useLearning,learningError} from '../../composables/useLearning'
import {validDate} from '../../utils/calendar'
import LearningRecordList from './LearningRecordList.vue'
const props=defineProps({date:{type:String,required:true}})
const {state,save,remove}=useLearning(),error=ref('')
const sessions=computed(()=>state.schedules.filter(s=>s.scheduled_date===props.date))
const records=computed(()=>state.records.filter(r=>r.study_date===props.date))
const roadmaps=computed(()=>state.roadmaps.filter(r=>r.start_date&&r.target_date&&r.start_date<=props.date&&r.target_date>=props.date))
const deadlines=computed(()=>state.milestones.filter(m=>m.due_date===props.date))
const task=s=>state.tasks.find(t=>t.task_id===s.task_id)
const milestone=s=>state.milestones.find(m=>m.milestone_id===task(s)?.milestone_id)
async function run(fn){error.value='';try{await fn()}catch(e){error.value=learningError(e)}}
function toggleTask(t,completed){if(t)run(()=>save('tasks',t.task_id,{is_completed:completed}))}
function moveSession(s,date){run(async()=>{if(!validDate(date))throw new Error('日付を選択してください。');await save('schedules',s.schedule_id,{scheduled_date:date})})}
function deleteSession(s){if(window.confirm('この学習予定を削除しますか？タスクと学習記録は保存されます。'))run(()=>remove('schedules',s.schedule_id))}
</script>
