<template><div class="learning-page learning"><RouterLink :to="backLink" class="learning-back">‹ {{ task?'やることに戻る':milestone?'マイルストーンに戻る':'カレンダーに戻る' }}</RouterLink><LearningStatus /><p v-if="stateError" class="learning-error" role="alert">{{ stateError }}</p><template v-if="record"><header class="learning-header"><div><span class="learning-eyebrow">LEARNING NOTES · {{ record.study_date }}</span><h1>{{ record.title }}</h1><p>{{ milestone ? milestone.title : 'マイルストーン未指定' }}<span v-if="task"> / <RouterLink :to="'/learning/tasks/'+task.task_id">{{ task.title }}</RouterLink></span></p></div><div class="learning-actions"><RouterLink class="learning-button" :to="'/learning/records/'+record.record_id+'/edit'">編集・関連付け</RouterLink><button class="danger" :disabled="state.busy" @click="deleteRecord">削除</button><RouterLink class="learning-button" :to="backLink">一覧に戻る</RouterLink></div></header><div class="learning-annotated-layout" :class="{'comments-closed':!panelOpen}"><article class="learning-record-article ui-surface"><button type="button" class="comment-panel-toggle" @click="panelOpen=!panelOpen">{{ panelOpen?'コメントを閉じる':'コメントを見る' }}（{{ comments.length }}）</button><div v-if="record.input_mode==='plain'" class="learning-plain-body">{{ record.body_markdown }}</div><LearningMarkdown v-else :model-value="record.body_markdown" :readonly="true" id="learning-record-preview" :annotations="true" :comments="comments" :selected="selectedLine" @select-line="selectLine" @anchors="anchors=$event" /><p v-if="!record.body_markdown" class="learning-empty-small">本文はまだありません。</p></article><LearningCommentPanel v-show="panelOpen" @close="panelOpen=false" :record-id="record.record_id" :selected="selectedLine" :anchors="anchors" @select="selectLine" /></div><RouterLink class="learning-button" :to="{path:'/calendar',query:{date:record.study_date}}">この日のカレンダーを見る →</RouterLink></template><p v-else-if="state.loaded" class="learning-empty ui-surface">学習記録が見つかりません。</p></div></template>
<script setup>
import {computed,onMounted,ref,watch,nextTick} from 'vue'
import {useRoute,useRouter} from 'vue-router'
import {useLearning} from '../composables/useLearning'
import LearningStatus from '../components/learning/LearningStatus.vue'
import LearningMarkdown from '../components/learning/LearningMarkdown.vue'
import LearningCommentPanel from '../components/learning/LearningCommentPanel.vue'
const route=useRoute(),router=useRouter(),{state,load,remove,loadRecord}=useLearning()
const record=computed(()=>state.records.find(r=>r.record_id===route.params.id))
const milestone=computed(()=>state.milestones.find(m=>m.milestone_id===record.value?.milestone_id))
const task=computed(()=>state.tasks.find(t=>t.task_id===record.value?.task_id))
const stateError=ref('')
const selectedLine=ref(null),anchors=ref([]),panelOpen=ref(false)
const comments=computed(()=>state.comments.filter(c=>c.record_id===record.value?.record_id))
async function selectLine(line){panelOpen.value=true;selectedLine.value={block_start:line.block_start,block_source:line.block_source,line_number:line.line_number,end_line:line.end_line||line.line_number,line_text:line.line_text};await nextTick();document.querySelector('.annotation-code-line.selected')?.scrollIntoView({block:'nearest',behavior:'smooth'})}
watch(()=>route.params.id,()=>{selectedLine.value=null;anchors.value=[];panelOpen.value=false})
const backLink=computed(()=>task.value?'/learning/tasks/'+task.value.task_id:milestone.value?'/learning/milestones/'+milestone.value.milestone_id:'/calendar')
async function deleteRecord(){if(window.confirm('この学習記録と関連するコメントを削除しますか？この操作は取り消せません。'))try{const back=task.value||milestone.value?backLink.value:{path:'/calendar',query:{date:record.value.study_date}};await remove('records',record.value.record_id);router.push(back)}catch{}}
watch(()=>route.params.id,async id=>{try{await load();await loadRecord(id)}catch(e){stateError.value=e.response?.data?.message||'学習ノートを読み込めませんでした。'}},{immediate:true})
</script>
