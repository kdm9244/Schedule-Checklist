<template>
  <div class="learning-page learning milestone-detail-page">
    <LearningStatus />
    <template v-if="milestone">
      <RouterLink class="learning-back" :to="'/learning/roadmaps/'+milestone.roadmap_id">‹ {{ roadmap?.title || '学習目標' }}</RouterLink>
      <header class="learning-header"><div><span class="learning-eyebrow">小さな目標</span><h1>{{ milestone.title }}</h1><p>{{ milestone.start_date || '未設定' }} 〜 {{ milestone.due_date || '未設定' }}</p></div><div class="learning-actions"><RouterLink class="learning-button" :to="'/learning/milestones/'+milestone.milestone_id+'/edit'">編集</RouterLink><button class="danger" :disabled="state.busy" @click="deleteMilestone">削除</button></div></header>
      <section class="learning-overview ui-surface"><div><h2>説明・完了基準</h2><p class="learning-description">{{ milestone.description || '完了基準はまだありません。' }}</p></div><LearningProgress :value="progress(tasks)" /></section>
      <section class="learning-form-card ui-surface"><LearningTaskList :milestone-id="milestone.milestone_id" /></section>
      <section class="learning-form-card ui-surface"><LearningRecordBrowser :milestone-id="milestone.milestone_id" /></section>
    </template><p v-else-if="state.loaded" class="learning-empty ui-surface">小さな目標が見つかりません。</p>
  </div>
</template>
<script setup>
import {computed,onMounted} from 'vue'
import {useRoute,useRouter} from 'vue-router'
import {useLearning,progress} from '../composables/useLearning'
import LearningStatus from '../components/learning/LearningStatus.vue'
import LearningProgress from '../components/learning/LearningProgress.vue'
import LearningTaskList from '../components/learning/LearningTaskList.vue'
import LearningRecordBrowser from '../components/learning/LearningRecordBrowser.vue'
const route=useRoute(),router=useRouter(),{state,load,remove}=useLearning()
const milestone=computed(()=>state.milestones.find(m=>m.milestone_id===route.params.id))
const roadmap=computed(()=>state.roadmaps.find(r=>r.roadmap_id===milestone.value?.roadmap_id))
const tasks=computed(()=>state.tasks.filter(t=>t.milestone_id===route.params.id))
const records=computed(()=>state.records.filter(r=>r.milestone_id===route.params.id))
async function deleteMilestone(){const m=milestone.value,s=state.schedules.filter(s=>tasks.value.some(t=>t.task_id===s.task_id)).length;if(window.confirm(`「${m.title}」とタスク${tasks.value.length}件、学習予定${s}件を削除します。学習記録${records.value.length}件は未指定の記録として保存されます。`))try{await remove('milestones',m.milestone_id);router.push('/learning/roadmaps/'+m.roadmap_id)}catch{}}
onMounted(()=>load().catch(()=>{}))
</script>
