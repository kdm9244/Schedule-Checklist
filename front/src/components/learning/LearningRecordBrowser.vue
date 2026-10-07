<template>
 <div class="note-browser">
  <form class="note-search-controls" @submit.prevent="apply"><label class="note-search-field">タイトル・本文を検索<input v-model="draft.q" type="search" maxlength="200" placeholder="キーワードを入力" /></label><button class="primary">検索</button><label>勉強した日（開始）<input v-model="draft.from" type="date" @change="apply" /></label><label>終了<input v-model="draft.to" type="date" @change="apply" /></label><label>入力形式<select v-model="draft.mode" @change="apply"><option value="">すべて</option><option value="plain">通常入力</option><option value="markdown">Markdown</option></select></label><label>並び順<select v-model="draft.order" @change="apply"><option value="newest">新しい順</option><option value="oldest">古い順</option></select></label><button type="button" @click="reset">リセット</button></form>
  <p v-if="error" class="learning-error" role="alert">{{ error }} <button @click="fetchPage">再試行</button></p>
  <p v-if="loading" role="status" class="learning-empty-small">読み込み中…</p>
  <template v-else-if="!error"><div class="note-result-summary">{{ result.total }}件<span> · {{ result.page }} / {{ result.pages }}ページ</span></div><LearningRecordList v-if="result.records.length" :records="result.records" :oldest="draft.order==='oldest'" /><p v-else class="learning-empty-small">条件に一致する学習ノートがありません。</p><nav v-if="result.total>10" class="note-pagination" aria-label="学習ノートのページ"><button :disabled="result.page<=1" @click="go(result.page-1)">‹ 前へ</button><button v-for="n in pageNumbers" :key="n" :aria-current="n===result.page?'page':undefined" @click="go(n)">{{ n }}</button><button :disabled="result.page>=result.pages" @click="go(result.page+1)">次へ ›</button></nav></template>
 </div>
</template>
<script setup>
import {computed,onBeforeUnmount,reactive,ref,watch} from 'vue'
import {useRoute} from 'vue-router'
import axios from 'axios'
import {API_ORIGIN} from '../../utils/http'
import {useLearning,learningError} from '../../composables/useLearning'
import LearningRecordList from './LearningRecordList.vue'
const props=defineProps({milestoneId:String,taskId:String})
const route=useRoute(),{state}=useLearning(),defaults=()=>({q:'',from:'',to:'',mode:'',order:'newest',page:1}),draft=reactive(defaults()),applied=ref(defaults()),loading=ref(false),error=ref(''),result=ref({records:[],total:0,page:1,pages:1})
let controller,revision=0,storageKey=''
const pageNumbers=computed(()=>{const start=Math.max(1,Math.min(result.value.page-2,result.value.pages-4));return Array.from({length:Math.min(5,result.value.pages)},(_,i)=>start+i)})
function remember(){try{sessionStorage.setItem(storageKey,JSON.stringify(applied.value))}catch{}}
async function fetchPage(){controller?.abort();controller=new AbortController();const version=++revision;loading.value=true;error.value='';try{const {data}=await axios.get(API_ORIGIN+'/api/learning/records',{withCredentials:true,signal:controller.signal,params:{...applied.value,milestone_id:props.milestoneId,task_id:props.taskId}});if(version!==revision)return;result.value=data;applied.value.page=data.page;remember()}catch(e){if(version===revision&&!axios.isCancel(e))error.value=learningError(e)}finally{if(version===revision)loading.value=false}}
function apply(){applied.value={...draft,page:1};remember();fetchPage()}
function go(page){applied.value.page=page;remember();fetchPage()}
function reset(){Object.assign(draft,defaults());apply()}
watch(()=>[state.owner,props.milestoneId,props.taskId],()=>{storageKey=`learning-note-list:${state.owner}:${route.path}:${props.milestoneId||''}:${props.taskId||''}`;let restored;try{restored=JSON.parse(sessionStorage.getItem(storageKey)||'null')}catch{}Object.assign(draft,defaults(),restored||{});applied.value={...draft};if(state.loaded)fetchPage()},{immediate:true})
watch(()=>state.records,()=>{if(state.loaded)fetchPage()})
onBeforeUnmount(()=>{controller?.abort();revision++})
</script>
