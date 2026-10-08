<template>
  <div class="learning-page learning roadmap-detail-page">
    <LearningStatus />
    <template v-if="roadmap">
      <header class="learning-header compact-goal-header"><div class="goal-title-area"><span class="learning-eyebrow">学習目標</span><h1>{{ roadmap.title }}</h1><div class="goal-heading-meta"><span>{{ roadmap.start_date || '未設定' }} 〜 {{ roadmap.target_date || '未設定' }}</span><span>{{ milestones.length }} 小さな目標</span></div><p v-if="roadmap.description" class="goal-heading-description">{{ roadmap.description }}</p></div><div class="goal-header-side"><div class="learning-actions"><RouterLink class="learning-button" to="/learning/roadmaps">一覧に戻る</RouterLink><details class="task-header-menu"><summary aria-label="学習目標の操作">⋯</summary><div><RouterLink class="learning-button" :to="'/learning/roadmaps/'+roadmap.roadmap_id+'/edit'">編集</RouterLink><button class="danger" :disabled="state.busy" @click="requestDelete('roadmaps',roadmap)">削除</button></div></details></div><div class="goal-header-progress"><LearningProgress :value="roadmapProgress" /></div></div></header>
      <div class="learning-section-heading roadmap-milestone-section"><div><h2>小さな目標</h2><small>順番に進めて、学習ノートを残しましょう。</small></div><RouterLink class="learning-button primary" :to="{path:'/learning/milestones/new',query:{roadmap:roadmap.roadmap_id}}">＋ 小さな目標を追加</RouterLink></div>
      <p v-if="!milestones.length" class="learning-empty ui-surface">最初の小さな目標を追加して、目標を分けましょう。</p>
      <section v-for="(m,index) in milestones" :key="m.milestone_id" class="learning-milestone ui-surface">
        <div class="learning-milestone-heading"><button class="learning-milestone-fold" :aria-expanded="!collapsed[m.milestone_id]" :aria-label="m.title+'を展開・折りたたむ'" @click="collapsed[m.milestone_id]=!collapsed[m.milestone_id]">{{ collapsed[m.milestone_id]?'＋':'−' }}</button><span class="learning-step" :class="{done:milestoneProgress(m).done}">{{ milestoneProgress(m).done?'✓':String(index+1).padStart(2,'0') }}</span><div class="learning-milestone-summary"><RouterLink :to="'/learning/milestones/'+m.milestone_id"><h3>{{ m.title }}</h3></RouterLink><small>{{ m.start_date || '未設定' }} 〜 {{ m.due_date || '未設定' }} · {{ milestoneProgress(m).percent }}%{{ milestoneProgress(m).done?' · 完了':'' }}</small></div><div class="learning-milestone-actions"><RouterLink class="learning-button" :to="'/learning/milestones/'+m.milestone_id">詳細を見る →</RouterLink><details class="task-header-menu"><summary :aria-label="m.title+'の操作'">⋯</summary><div><button :disabled="state.busy||index===0" @click="move(index,-1)">↑ 上に移動</button><button :disabled="state.busy||index===milestones.length-1" @click="move(index,1)">↓ 下に移動</button><RouterLink class="learning-button" :to="'/learning/milestones/'+m.milestone_id+'/edit'">編集</RouterLink><button class="danger" :disabled="state.busy" @click="requestDelete('milestones',m)">削除</button></div></details></div></div>
        <div v-if="!collapsed[m.milestone_id]" class="learning-milestone-body"><p class="learning-description">{{ m.description || '完了基準はまだありません。' }}</p><LearningTaskList :milestone-id="m.milestone_id" /><LearningRecordBrowser :milestone-id="m.milestone_id" /></div>
      </section>
      <DeleteConfirmModal v-if="deletion" :title="deletion.kind==='roadmaps'?'学習目標を削除しますか？':'小さな目標を削除しますか？'" :description="deleteDescription" :busy="state.busy" :error="deleteError" @close="deletion=null" @confirm="confirmDelete" />
    </template>
    <p v-else-if="state.loaded" class="learning-empty ui-surface">学習目標が見つかりません。</p>
  </div>
</template>
<script setup>
import {computed,onMounted,reactive,ref} from 'vue'
import {useRoute,useRouter} from 'vue-router'
import {useLearning,progress,learningError} from '../composables/useLearning'
import DeleteConfirmModal from '../components/DeleteConfirmModal.vue'
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
const deletion=ref(null),deleteError=ref('')
function requestDelete(kind,item){deleteError.value='';deletion.value={kind,item};document.querySelectorAll('.task-header-menu[open]').forEach(el=>el.removeAttribute('open'))}
const deleteDescription=computed(()=>{if(!deletion.value)return '';const {kind,item}=deletion.value,ms=kind==='roadmaps'?milestones.value:[item],ts=ms.flatMap(milestoneTasks),s=state.schedules.filter(s=>ts.some(t=>t.task_id===s.task_id)).length,r=state.records.filter(r=>ms.some(m=>m.milestone_id===r.milestone_id)).length;return `「${item.title}」${kind==='roadmaps'?'と小さな目標'+ms.length+'件':''}、やること${ts.length}件、学習予定${s}件を削除します。\n学習ノート${r}件とコメントは保存され、関連付けだけ解除されます。`})
async function confirmDelete(){const {kind,item}=deletion.value;try{await remove(kind,item[kind==='roadmaps'?'roadmap_id':'milestone_id']);deletion.value=null;if(kind==='roadmaps')router.push('/learning/roadmaps')}catch(e){deleteError.value=learningError(e)}}
onMounted(()=>load().catch(()=>{}))
</script>
