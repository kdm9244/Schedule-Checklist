<template>
  <div class="learning-page learning task-detail-page">
    <LearningStatus />
    <template v-if="task && milestone">
      <nav class="learning-task-breadcrumb" aria-label="学習の階層"><RouterLink :to="'/learning/roadmaps/'+milestone.roadmap_id">{{ roadmap?.title || '学習目標' }}</RouterLink><span>›</span><RouterLink :to="'/learning/milestones/'+milestone.milestone_id">{{ milestone.title }}</RouterLink><span>› やることの詳細</span></nav>
      <header class="learning-header task-note-header"><div><span class="learning-eyebrow">やることの詳細</span><h1>{{ task.title }}</h1><span class="task-header-status">{{ task.is_completed?'完了':'学習中' }}</span></div><div class="learning-actions"><button :class="{'task-complete-button':task.is_completed}" :disabled="state.busy" :aria-pressed="task.is_completed" :title="task.is_completed?'クリックで完了を解除':'完了にする'" @click="toggleComplete">{{ task.is_completed?'✓ 完了済み':'完了にする' }}</button><RouterLink class="learning-button" :to="'/learning/milestones/'+milestone.milestone_id">一覧に戻る</RouterLink><details class="task-header-menu"><summary aria-label="やることの操作">⋯</summary><div><button @click="taskModal='edit'">名前・期間を編集</button><button @click="taskModal='move'">別の小さな目標へ移動</button><button class="danger" :disabled="state.busy" @click="requestDelete">削除</button></div></details></div></header>
      <form v-if="editing" class="task-rename-form" @submit.prevent="rename"><input v-model="editTitle" required maxlength="200" aria-label="やることの名前" /><button class="primary" :disabled="state.busy">保存</button><button type="button" @click="editing=false">キャンセル</button></form>
      <p v-if="error" class="learning-error" role="alert">{{ error }}</p>
      <section class="learning-form-card ui-surface task-note-section compact-notes"><div class="learning-section-heading"><div class="section-title-group"><h2>学習ノート</h2><span class="section-count">{{ records.length }}</span></div><RouterLink class="learning-button primary" :to="noteLink">＋ 学習ノートを書く</RouterLink></div><LearningRecordBrowser :task-id="task.task_id" /></section>
      <LearningTaskModal v-if="taskModal" :milestone-id="task.milestone_id" :task="task" :move="taskModal==='move'" @close="taskModal=null" @saved="taskModal=null" />
      <DeleteConfirmModal v-if="confirmDelete" title="このやることを削除しますか？" :description="deleteDescription" :busy="state.busy" :error="error" @close="confirmDelete=false" @confirm="deleteTask" />
    </template><p v-else-if="state.loaded" class="learning-empty ui-surface">タスクが見つかりません。削除後も学習記録は保存されます。<RouterLink to="/learning/roadmaps">学習目標一覧へ</RouterLink></p>
  </div>
</template>
<script setup>
import {computed,onMounted,ref} from 'vue'
import {useRoute,useRouter} from 'vue-router'
import {useLearning,learningError} from '../composables/useLearning'
import LearningTaskModal from '../components/learning/LearningTaskModal.vue'
import DeleteConfirmModal from '../components/DeleteConfirmModal.vue'
import LearningStatus from '../components/learning/LearningStatus.vue'
import LearningRecordBrowser from '../components/learning/LearningRecordBrowser.vue'
const route=useRoute(),router=useRouter(),{state,load,save,remove}=useLearning(),editing=ref(false),editTitle=ref(''),error=ref(''),confirmDelete=ref(false),taskModal=ref(null)
const task=computed(()=>state.tasks.find(t=>t.task_id===route.params.id))
const milestone=computed(()=>state.milestones.find(m=>m.milestone_id===task.value?.milestone_id))
const roadmap=computed(()=>state.roadmaps.find(r=>r.roadmap_id===milestone.value?.roadmap_id))
const records=computed(()=>state.records.filter(r=>r.task_id===task.value?.task_id))
const noteLink=computed(()=>({path:'/learning/records/new',query:{task:task.value?.task_id,milestone:milestone.value?.milestone_id,roadmap:milestone.value?.roadmap_id}}))
async function run(fn){error.value='';try{await fn()}catch(e){error.value=learningError(e)}}
function toggleComplete(){run(()=>save('tasks',task.value.task_id,{is_completed:!task.value.is_completed}))}
function startEdit(){editing.value=true;editTitle.value=task.value.title;document.querySelector('.task-header-menu')?.removeAttribute('open')}
function rename(){run(async()=>{if(!editTitle.value.trim())throw new Error('名前を入力してください。');await save('tasks',task.value.task_id,{title:editTitle.value});editing.value=false})}
const deleteDescription=computed(()=>`「${task.value?.title||''}」と学習予定${state.schedules.filter(s=>s.task_id===task.value?.task_id).length}件を削除します。\n学習ノート${records.value.length}件とコメントは保存され、やることの関連付けだけ解除されます。`)
function requestDelete(){error.value='';confirmDelete.value=true;document.querySelector('.task-header-menu')?.removeAttribute('open')}
function deleteTask(){const id=task.value.task_id,parent=milestone.value.milestone_id;run(async()=>{await remove('tasks',id);confirmDelete.value=false;router.push('/learning/milestones/'+parent)})}

onMounted(()=>load().catch(()=>{}))
</script>
