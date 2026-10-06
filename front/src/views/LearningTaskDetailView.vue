<template>
  <div class="learning-page learning">
    <LearningStatus />
    <template v-if="task && milestone">
      <nav class="learning-task-breadcrumb" aria-label="学習の階層"><RouterLink :to="'/learning/roadmaps/'+milestone.roadmap_id">{{ roadmap?.title || 'ロードマップ' }}</RouterLink><span>›</span><RouterLink :to="'/learning/milestones/'+milestone.milestone_id">{{ milestone.title }}</RouterLink><span>› やること</span></nav>
      <header class="learning-header"><div><span class="learning-eyebrow">LEARNING TASK</span><h1>{{ task.title }}</h1><p>{{ task.is_completed ? '完了' : '学習中' }} · 学習ノートの保存とタスクの完了は別々に管理されます。</p></div><RouterLink class="learning-button primary" :to="noteLink">＋ 学習ノートを書く</RouterLink></header>
      <section class="learning-form-card ui-surface"><h2>完了状態・学習予定</h2><LearningTaskList :milestone-id="milestone.milestone_id" :task-id="task.task_id" /></section>
      <section class="learning-form-card ui-surface"><div class="learning-section-heading"><h2>学習ノート</h2><span>{{ records.length }}件 · このタスクに関連する記録</span></div><p class="learning-empty-small">概念・用語は通常入力、コードの練習は Markdown で記録できます。何度でもノートを追加できます。</p><LearningRecordList :records="records" /></section>
    </template><p v-else-if="state.loaded" class="learning-empty ui-surface">タスクが見つかりません。削除後も学習記録は保存されます。<RouterLink to="/learning/roadmaps">ロードマップ一覧へ</RouterLink></p>
  </div>
</template>
<script setup>
import {computed,onMounted} from 'vue'
import {useRoute} from 'vue-router'
import {useLearning} from '../composables/useLearning'
import LearningStatus from '../components/learning/LearningStatus.vue'
import LearningTaskList from '../components/learning/LearningTaskList.vue'
import LearningRecordList from '../components/learning/LearningRecordList.vue'
const route=useRoute(),{state,load}=useLearning()
const task=computed(()=>state.tasks.find(t=>t.task_id===route.params.id))
const milestone=computed(()=>state.milestones.find(m=>m.milestone_id===task.value?.milestone_id))
const roadmap=computed(()=>state.roadmaps.find(r=>r.roadmap_id===milestone.value?.roadmap_id))
const records=computed(()=>state.records.filter(r=>r.task_id===task.value?.task_id))
const noteLink=computed(()=>({path:'/learning/records/new',query:{task:task.value?.task_id,milestone:milestone.value?.milestone_id,roadmap:milestone.value?.roadmap_id}}))
onMounted(()=>load().catch(()=>{}))
</script>
