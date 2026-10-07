<template>
  <div class="learning-page learning">
    <RouterLink to="/learning/roadmaps" class="learning-back">‹ ロードマップ一覧</RouterLink><LearningStatus />
    <template v-if="roadmap">
      <header class="learning-header"><div><span class="learning-eyebrow">YOUR ROADMAP</span><h1>{{ roadmap.title }}</h1></div><div class="learning-actions"><RouterLink class="learning-button" :to="'/learning/roadmaps/'+roadmap.roadmap_id+'/edit'">編集</RouterLink><RouterLink class="learning-button primary" :to="{path:'/learning/milestones/new',query:{roadmap:roadmap.roadmap_id}}">＋ マイルストーン</RouterLink><button class="danger" :disabled="state.busy" @click="deleteRoadmap">削除</button></div></header>
      <section class="learning-overview ui-surface"><div><p class="learning-description">{{ roadmap.description || '説明はまだありません。' }}</p><span class="learning-date-line">期間 <strong>{{ roadmap.start_date || '未設定' }} 〜 {{ roadmap.target_date || '未設定' }}</strong></span></div><LearningProgress :value="roadmapProgress" /></section>
      <div class="learning-section-heading"><h2>マイルストーン</h2><span>{{ milestones.length }} ステップ · タスクの完了で進捗が更新されます</span></div>
      <p v-if="!milestones.length" class="learning-empty ui-surface">最初のマイルストーンを追加して、目標を分けましょう。</p>
      <section v-for="(m,index) in milestones" :key="m.milestone_id" class="learning-milestone ui-surface">
        <div class="learning-milestone-heading"><button class="learning-milestone-fold" :aria-expanded="!collapsed[m.milestone_id]" :aria-label="m.title+'を展開・折りたたむ'" @click="collapsed[m.milestone_id]=!collapsed[m.milestone_id]">{{ collapsed[m.milestone_id]?'＋':'−' }}</button><span class="learning-step" :class="{done:milestoneProgress(m).done}">{{ milestoneProgress(m).done?'✓':String(index+1).padStart(2,'0') }}</span><div class="learning-milestone-summary"><RouterLink :to="'/learning/milestones/'+m.milestone_id"><h3>{{ m.title }}</h3></RouterLink><small>{{ m.start_date || '未設定' }} 〜 {{ m.due_date || '未設定' }} · {{ milestoneProgress(m).percent }}%{{ milestoneProgress(m).done?' · 完了':'' }}</small></div><div class="learning-milestone-actions"><RouterLink :to="'/learning/milestones/'+m.milestone_id">詳細を見る →</RouterLink><button :disabled="state.busy||index===0" aria-label="上に移動" @click="move(index,-1)">↑</button><button :disabled="state.busy||index===milestones.length-1" aria-label="下に移動" @click="move(index,1)">↓</button><RouterLink :to="'/learning/milestones/'+m.milestone_id+'/edit'">編集</RouterLink><button class="quiet danger" :disabled="state.busy" @click="deleteMilestone(m)">削除</button></div></div>
        <div v-if="!collapsed[m.milestone_id]" class="learning-milestone-body"><p class="learning-description">{{ m.description || '完了基準はまだありません。' }}</p><LearningProgress :value="milestoneProgress(m)" /><div class="learning-section-heading"><h4>やること</h4><span>学習予定は同じタスクに何度でも追加できます</span></div><LearningTaskList :milestone-id="m.milestone_id" /><div class="learning-section-heading"><h4>学習記録</h4><RouterLink class="learning-button" :to="{path:'/learning/records/new',query:{milestone:m.milestone_id,roadmap:roadmap.roadmap_id}}">＋ 記録を書く</RouterLink></div><LearningRecordBrowser :milestone-id="m.milestone_id" /></div>
      </section>
    </template>
    <p v-else-if="state.loaded" class="learning-empty ui-surface">ロードマップが見つかりません。</p>
  </div>
</template>
<script setup>
import {computed,onMounted,reactive} from 'vue'
import {useRoute,useRouter} from 'vue-router'
import {useLearning,progress} from '../composables/useLearning'
import LearningStatus from '../components/learning/LearningStatus.vue'
import LearningProgress from '../components/learning/LearningProgress.vue'
import LearningTaskList from '../components/learning/LearningTaskList.vue'
import LearningRecordBrowser from '../components/learning/LearningRecordBrowser.vue'
const route=useRoute(),router=useRouter(),{state,load,remove,reorder}=useLearning(),collapsed=reactive({})
const roadmap=computed(()=>state.roadmaps.find(r=>r.roadmap_id===route.params.id))
const milestones=computed(()=>state.milestones.filter(m=>m.roadmap_id===route.params.id).sort((a,b)=>a.sort_order-b.sort_order||Number(a.milestone_id)-Number(b.milestone_id)))
const milestoneTasks=m=>state.tasks.filter(t=>t.milestone_id===m.milestone_id)
const milestoneProgress=m=>progress(milestoneTasks(m))
const roadmapProgress=computed(()=>progress(milestones.value.flatMap(milestoneTasks)))
async function move(index,amount){const ids=milestones.value.map(m=>m.milestone_id);[ids[index],ids[index+amount]]=[ids[index+amount],ids[index]];try{await reorder(route.params.id,ids)}catch{}}
async function deleteMilestone(m){const ts=milestoneTasks(m),s=state.schedules.filter(s=>ts.some(t=>t.task_id===s.task_id)).length,r=state.records.filter(r=>r.milestone_id===m.milestone_id).length;if(window.confirm(`「${m.title}」とタスク${ts.length}件、学習予定${s}件を削除します。学習記録${r}件は未指定の記録として保存されます。`))try{await remove('milestones',m.milestone_id)}catch{}}
async function deleteRoadmap(){const ts=milestones.value.flatMap(milestoneTasks),s=state.schedules.filter(s=>ts.some(t=>t.task_id===s.task_id)).length,r=state.records.filter(r=>milestones.value.some(m=>m.milestone_id===r.milestone_id)).length;if(window.confirm(`ロードマップとマイルストーン${milestones.value.length}件、タスク${ts.length}件、学習予定${s}件を削除します。学習記録${r}件は未指定の記録として保存されます。`))try{await remove('roadmaps',route.params.id);router.push('/learning/roadmaps')}catch{}}
onMounted(()=>load().catch(()=>{}))
</script>
