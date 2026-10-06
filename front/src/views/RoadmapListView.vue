<template>
  <div class="learning-page learning">
    <header class="learning-header"><div><span class="learning-eyebrow">LEARNING JOURNEY</span><h1>ロードマップ</h1><p>目標を小さなステップに分けて、学びを積み重ねる。</p></div><RouterLink class="learning-button primary" to="/learning/roadmaps/new">＋ ロードマップ作成</RouterLink></header>
    <LearningStatus />
    <div v-if="state.loaded" class="learning-stats"><div><span>ロードマップ</span><strong>{{ state.roadmaps.length }}<small>件</small></strong></div><div><span>完了したタスク</span><strong>{{ allProgress.completed }}<small>/ {{ allProgress.total }}</small></strong></div><div><span>学習記録</span><strong>{{ state.records.length }}<small>件</small></strong></div></div>
    <div v-if="state.loaded&&!state.roadmaps.length" class="learning-empty ui-surface"><span>◇</span><h2>最初のロードマップをつくろう</h2><p>学びたいことと目標日を決めて、最初の一歩を。</p><RouterLink class="learning-button primary" to="/learning/roadmaps/new">ロードマップ作成</RouterLink></div>
    <div class="learning-roadmap-grid"><article v-for="r in state.roadmaps" :key="r.roadmap_id" class="learning-roadmap-card ui-surface"><RouterLink class="learning-card-main" :to="'/learning/roadmaps/'+r.roadmap_id"><div class="learning-card-label"><span>ROADMAP</span><span>{{ milestones(r).length }} マイルストーン</span></div><h2 class="learning-card-title">{{ r.title }}</h2><p class="learning-description-excerpt">{{ r.description || '説明はまだありません。' }}</p><div class="learning-date-line">期間 <strong>{{ r.start_date || '未設定' }} 〜 {{ r.target_date || '未設定' }}</strong></div><LearningProgress :value="progress(tasks(r))" /><div class="learning-next"><small>次にやること</small><strong>{{ tasks(r).find(t=>!t.is_completed)?.title || (tasks(r).length?'すべてのタスクが完了しました':'最初のタスクを追加しましょう') }}</strong></div></RouterLink><div class="learning-card-footer"><RouterLink :to="'/learning/roadmaps/'+r.roadmap_id">詳細を見る →</RouterLink><div><RouterLink :to="'/learning/roadmaps/'+r.roadmap_id+'/edit'">編集</RouterLink><button class="quiet danger" :disabled="state.busy" @click="deleteRoadmap(r)">削除</button></div></div></article></div>
  </div>
</template>
<script setup>
import {computed,onMounted} from 'vue'
import {useLearning,progress} from '../composables/useLearning'
import LearningStatus from '../components/learning/LearningStatus.vue'
import LearningProgress from '../components/learning/LearningProgress.vue'
const {state,load,remove}=useLearning()
const milestones=r=>state.milestones.filter(m=>m.roadmap_id===r.roadmap_id).sort((a,b)=>a.sort_order-b.sort_order)
const tasks=r=>milestones(r).flatMap(m=>state.tasks.filter(t=>t.milestone_id===m.milestone_id).sort((a,b)=>a.sort_order-b.sort_order))
const allProgress=computed(()=>progress(state.tasks))
async function deleteRoadmap(r){const ms=milestones(r),ts=tasks(r),count=state.schedules.filter(s=>ts.some(t=>t.task_id===s.task_id)).length,records=state.records.filter(j=>ms.some(m=>m.milestone_id===j.milestone_id)).length;if(window.confirm(`「${r.title}」を削除します。マイルストーン${ms.length}件、タスク${ts.length}件、学習予定${count}件も削除されます。学習記録${records}件は未指定の記録として保存されます。`))try{await remove('roadmaps',r.roadmap_id)}catch{}}
onMounted(()=>load().catch(()=>{}))
</script>
