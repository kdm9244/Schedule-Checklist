<template>
  <div class="learning-page learning note-workspace">
    <RouterLink :to="backLink" class="learning-back">‹ {{ editing?'学習ノートに戻る':'学習画面に戻る' }}</RouterLink>
    <header class="learning-header note-page-header"><div><h1>{{ editing?'学習ノートを編集':'学習ノートを書く' }}</h1><p>学んだことを整理して、自分の言葉で残しましょう。</p></div><span v-if="draftStatus" class="learning-draft-status" role="status">{{ draftStatus }}</span></header>
    <LearningStatus />
    <form v-if="ready" class="learning-record-form" @submit.prevent="submit">
      <section class="ui-surface note-info">
        <div class="note-primary-fields learning-form"><label class="note-title">タイトル <span class="required">必須</span><input v-model="form.title" maxlength="200" required placeholder="例：Java の条件分岐と比較演算子" /></label><label>勉強した日 <span class="required">必須</span><input v-model="form.study_date" type="date" required /></label></div>
        <details class="note-connections">
          <summary><span>関連する学習</span><span class="note-context">{{ connectionLabel }}</span><span class="note-change">変更する⌄</span></summary>
          <div class="learning-form note-connection-fields"><label>学習目標<select v-model="roadmapId" @change="changeRoadmap"><option value="">未指定</option><option v-for="r in state.roadmaps" :key="r.roadmap_id" :value="r.roadmap_id">{{ r.title }}</option></select></label><label>小さな目標<select v-model="form.milestone_id" @change="changeMilestone"><option value="">未指定</option><option v-for="m in milestoneOptions" :key="m.milestone_id" :value="m.milestone_id">{{ m.title }}</option></select></label><label>やること<select v-model="form.task_id" :disabled="!form.milestone_id"><option value="">未指定</option><option v-for="t in taskOptions" :key="t.task_id" :value="t.task_id">{{ t.title }}</option></select></label></div>
          <p class="note-help">関連付けは任意です。後から変更することもできます。</p>
        </details>
        <div v-if="recommendations.length" class="learning-recommendations"><span>この日の学習予定：</span><button v-for="t in recommendations" :key="t.task_id" type="button" @click="recommend(t)">{{ t.title }}</button></div>
      </section>
      <section class="learning-editor-card ui-surface note-editor">
        <div class="note-editor-top"><h2>学習内容</h2><div class="note-mode-tabs" role="group" aria-label="入力形式"><button type="button" :aria-pressed="form.input_mode==='plain'" @click="form.input_mode='plain'">通常入力</button><button type="button" :aria-pressed="form.input_mode==='markdown'" @click="form.input_mode='markdown'">Markdown</button></div><button type="button" class="note-template" @click="insertTemplate">テンプレートを挿入</button></div>
        <div class="note-editor-help"><span>{{ form.input_mode==='plain'?'用語や学んだ内容を自由に書けます。':'左に本文・コードを入力すると、右に仕上がりが表示されます。' }}</span><small>切り替えても本文は保持されます</small></div>
        <textarea v-if="form.input_mode==='plain'" v-model="form.body_markdown" class="learning-plain-editor" maxlength="200000" aria-label="学習内容" placeholder="今日学んだ概念、覚えておきたい用語、気づいたことを書いてみましょう。"></textarea>
        <template v-else><div class="learning-editor-labels"><span>本文・コード</span><span>プレビュー</span></div><LearningMarkdown v-model="form.body_markdown" id="learning-record-editor" @save="submit" /></template>
      </section>
      <p v-if="error" class="learning-error" role="alert">{{ error }}</p>
      <footer class="learning-save-bar note-save-bar"><span>下書きはこのブラウザーに自動保存されます。</span><div class="learning-actions"><button type="button" @click="cancel">キャンセル</button><button class="primary" :disabled="state.busy">{{ state.busy?'保存中...':'学習ノートを保存' }}</button></div></footer>
    </form><p v-else-if="state.loaded&&!state.loading" class="learning-empty">学習記録が見つかりません。</p>
  </div>
</template>
<script setup>
import {computed,nextTick,onBeforeUnmount,reactive,ref,watch} from 'vue'
import {useRoute,useRouter,onBeforeRouteLeave} from 'vue-router'
import {useLearning,learningTemplate,learningError} from '../composables/useLearning'
import {dateKey,validDate} from '../utils/calendar'
import LearningStatus from '../components/learning/LearningStatus.vue'
import LearningMarkdown from '../components/learning/LearningMarkdown.vue'
const route=useRoute(),router=useRouter(),{state,load,save,loadRecord}=useLearning()
const editing=computed(()=>!!route.params.id),ready=ref(false),error=ref(''),roadmapId=ref(''),draftStatus=ref(''),form=reactive({study_date:'',title:'',milestone_id:'',task_id:'',body_markdown:'',input_mode:'markdown'})
let draftKey='',timer,finished=false,baseline='',initialization=0
const milestoneOptions=computed(()=>state.milestones.filter(m=>!roadmapId.value||m.roadmap_id===roadmapId.value).sort((a,b)=>a.sort_order-b.sort_order))
const connectionLabel=computed(()=>[state.roadmaps.find(r=>r.roadmap_id===roadmapId.value)?.title,state.milestones.find(m=>m.milestone_id===form.milestone_id)?.title,state.tasks.find(t=>t.task_id===form.task_id)?.title].filter(Boolean).join(' / ')||'未指定')
const taskOptions=computed(()=>state.tasks.filter(t=>t.milestone_id===form.milestone_id))
const recommendations=computed(()=>{const ids=state.schedules.filter(s=>s.scheduled_date===form.study_date).map(s=>s.task_id);return state.tasks.filter(t=>ids.includes(t.task_id))})
const backLink=computed(()=>editing.value?'/learning/records/'+route.params.id:form.task_id?'/learning/tasks/'+form.task_id:form.milestone_id?'/learning/milestones/'+form.milestone_id:roadmapId.value?'/learning/roadmaps/'+roadmapId.value:'/calendar')
function changeRoadmap(){form.milestone_id='';form.task_id=''}
function changeMilestone(){const m=state.milestones.find(m=>m.milestone_id===form.milestone_id);if(m)roadmapId.value=m.roadmap_id;if(!taskOptions.value.some(t=>t.task_id===form.task_id))form.task_id=''}
function recommend(t){form.milestone_id=t.milestone_id;form.task_id=t.task_id;const m=state.milestones.find(m=>m.milestone_id===t.milestone_id);roadmapId.value=m?.roadmap_id||''}
function serialized(){return JSON.stringify({form:{...form},roadmapId:roadmapId.value})}
function persistDraft(){clearTimeout(timer);if(!ready.value||finished||!draftKey||serialized()===baseline)return;try{localStorage.setItem(draftKey,serialized());draftStatus.value='下書きをこのブラウザーに保存しました'}catch{draftStatus.value='下書きを保存できません。画面を閉じる前に記録を保存してください。'}}
async function initialize(){const version=++initialization;persistDraft();ready.value=false;finished=false;error.value='';draftStatus.value='';try{await load();if(editing.value)await loadRecord(route.params.id)}catch(e){error.value=learningError(e);return}if(version!==initialization)return;const record=editing.value?state.records.find(r=>r.record_id===route.params.id):null;if(editing.value&&!record)return;Object.assign(form,{study_date:validDate(route.query.date)?route.query.date:dateKey(new Date()),title:'',body_markdown:'',input_mode:'markdown',milestone_id:String(route.query.milestone||''),task_id:String(route.query.task||'')},record||{});form.milestone_id ||= '';form.task_id ||= '';const m=state.milestones.find(m=>m.milestone_id===form.milestone_id);if(!m){form.milestone_id='';form.task_id=''}roadmapId.value=m?.roadmap_id||String(route.query.roadmap||'');changeMilestone();baseline=serialized();draftKey=`learning-draft-v1:db:${state.owner}:${editing.value?'record-'+route.params.id:'new-'+form.study_date+'-'+form.milestone_id+'-'+form.task_id}`;try{const draft=JSON.parse(localStorage.getItem(draftKey)||'null');if(draft?.form){Object.assign(form,draft.form);roadmapId.value=draft.roadmapId||'';if(!state.milestones.some(m=>m.milestone_id===form.milestone_id)){form.milestone_id='';form.task_id=''}changeMilestone();draftStatus.value='保存済みの下書きを復元しました'}}catch{draftStatus.value='下書きを読み込めませんでした。'}await nextTick();ready.value=true}
function insertTemplate(){if(form.input_mode==='plain'){form.body_markdown+=(form.body_markdown?'\n\n':'')+'学んだ概念\n\n実習コード\n\nエラーと解決の過程\n\n次にやること\n';return;}if(form.body_markdown.trim())form.body_markdown+='\n\n'+learningTemplate;else form.body_markdown=learningTemplate}
async function submit(){if(state.busy||!ready.value)return;error.value='';try{if(!form.title.trim()||!validDate(form.study_date))throw new Error('勉強した日とタイトルを入力してください。');if(form.body_markdown.length>200000)throw new Error('本文は200,000文字以内で入力してください。');const before=state.records.map(r=>r.record_id);await save('records',editing.value?route.params.id:null,{...form,milestone_id:form.milestone_id||null,task_id:form.task_id||null});finished=true;clearTimeout(timer);try{localStorage.removeItem(draftKey)}catch{draftStatus.value='保存は完了しましたが、下書きの削除に失敗しました。'}const saved=editing.value?route.params.id:state.records.find(r=>!before.includes(r.record_id))?.record_id;router.push('/learning/records/'+saved)}catch(e){error.value=learningError(e)}}
function cancel(){router.push(backLink.value)}
watch([form,roadmapId],()=>{if(ready.value&&!finished){clearTimeout(timer);timer=setTimeout(persistDraft,500)}},{deep:true})
watch(()=>route.fullPath,initialize,{immediate:true})
function beforeUnload(e){persistDraft();if(ready.value&&!finished&&serialized()!==baseline){e.preventDefault();e.returnValue=''}}
window.addEventListener('beforeunload',beforeUnload)
onBeforeRouteLeave(()=>{persistDraft();if(ready.value&&!finished&&serialized()!==baseline)return window.confirm('編集中の内容は下書きに保存されます。画面を移動しますか？')})
onBeforeUnmount(()=>{persistDraft();clearTimeout(timer);window.removeEventListener('beforeunload',beforeUnload)})
</script>
