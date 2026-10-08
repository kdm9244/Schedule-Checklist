<template>
  <Teleport to="body"><dialog ref="dialog" class="pdf-upload-dialog" aria-labelledby="pdf-upload-heading" @cancel.prevent="close">
    <form @submit.prevent="upload">
      <header><div><span class="eyebrow">PDF NOTE</span><h2 id="pdf-upload-heading">PDFノートを追加</h2><p>資料を選んで、すぐに読み始めましょう。</p></div><button type="button" class="close-button" aria-label="閉じる" :disabled="busy" @click="close">×</button></header>
      <fieldset :disabled="busy">
        <div class="drop-zone" :class="{ dragging, selected: file }" @dragover.prevent="dragging=true" @dragleave.prevent="dragging=false" @drop.prevent="drop">
          <span class="file-icon" aria-hidden="true">PDF</span><strong>{{ file ? file.name : 'PDFをここにドラッグ' }}</strong>
          <span>{{ file ? (file.size/1048576).toFixed(1)+' MB' : 'PDFファイル · 最大30MB' }}</span>
          <button type="button" @click="fileInput.click()">{{ file ? '別のファイルを選ぶ' : 'ファイルを選ぶ' }}</button>
          <input ref="fileInput" class="visually-hidden" type="file" accept="application/pdf,.pdf" aria-label="PDFファイルを選択" @change="choose($event.target.files[0])" />
        </div>
        <label class="title-field">タイトル<input v-model="title" maxlength="200" required placeholder="ファイルを選ぶと自動で入力されます" /></label>
        <details class="connections"><summary><span>学習との関連付け <small>任意</small></span><span class="connection-summary">{{ contextLabel }}</span></summary>
          <div class="connection-fields"><label>学習目標<select v-model="roadmap" @change="milestone='';task=''"><option value="">未指定</option><option v-for="r in state.roadmaps" :key="r.roadmap_id" :value="r.roadmap_id">{{ r.title }}</option></select></label><label>小さな目標<select v-model="milestone" :disabled="!roadmap" @change="task=''"><option value="">未指定</option><option v-for="m in state.milestones.filter(m=>m.roadmap_id===roadmap)" :key="m.milestone_id" :value="m.milestone_id">{{ m.title }}</option></select></label><label>やること<select v-model="task" :disabled="!milestone"><option value="">未指定</option><option v-for="t in state.tasks.filter(t=>t.milestone_id===milestone)" :key="t.task_id" :value="t.task_id">{{ t.title }}</option></select></label></div>
        </details>
      </fieldset>
      <p v-if="error" class="upload-error" role="alert">{{ error }}</p>
      <footer><button type="button" :disabled="busy" @click="close">キャンセル</button><button class="primary" :disabled="busy||!file||!title.trim()">{{ busy?'アップロード中…':'追加して開く' }}</button></footer>
    </form>
  </dialog></Teleport>
</template>
<script setup>
import {computed,onMounted,onBeforeUnmount,ref} from 'vue'
import {useRouter} from 'vue-router'
import axios from 'axios'
import {API_ORIGIN} from '../../utils/http'
import {useLearning} from '../../composables/useLearning'
const props=defineProps({roadmapId:String,milestoneId:String,taskId:String}),emit=defineEmits(['close','created'])
const {state}=useLearning(),router=useRouter(),dialog=ref(null),fileInput=ref(null),file=ref(null),title=ref(''),roadmap=ref(''),milestone=ref(''),task=ref(''),busy=ref(false),error=ref(''),dragging=ref(false)
let previous,automaticTitle=''
const contextLabel=computed(()=>[state.roadmaps.find(r=>r.roadmap_id===roadmap.value)?.title,state.milestones.find(m=>m.milestone_id===milestone.value)?.title,state.tasks.find(t=>t.task_id===task.value)?.title].filter(Boolean).join(' / ')||'未指定')
function close(){if(!busy.value)emit('close')}
function choose(value){
 error.value='';if(!value)return
 if(!/\.pdf$/i.test(value.name)||value.size>30*1048576||!value.size){error.value='30MB以下のPDFファイルを選択してください。';return}
 file.value=value
 if(!title.value.trim()||title.value===automaticTitle)title.value=value.name.replace(/\.pdf$/i,'').slice(0,200)
 automaticTitle=value.name.replace(/\.pdf$/i,'').slice(0,200)
}
function drop(event){dragging.value=false;if(!busy.value)choose(event.dataTransfer.files[0])}
async function upload(){
 if(busy.value||!file.value)return
 busy.value=true;error.value=''
 try{
  if(await file.value.slice(0,5).text()!=='%PDF-')throw Error('PDFファイルの形式を確認してください。')
  const {data}=await axios.post(API_ORIGIN+'/api/pdf-notes',file.value,{withCredentials:true,headers:{'Content-Type':'application/pdf'},params:{title:title.value.trim(),roadmap_id:roadmap.value,milestone_id:milestone.value,task_id:task.value}})
  emit('created',data);router.push('/learning/pdf-notes/'+data.note_id)
 }catch(e){error.value=e.response?.data?.message||e.message}finally{busy.value=false}
}
onMounted(()=>{task.value=props.taskId||'';milestone.value=props.milestoneId||state.tasks.find(t=>t.task_id===task.value)?.milestone_id||'';roadmap.value=props.roadmapId||state.milestones.find(m=>m.milestone_id===milestone.value)?.roadmap_id||'';previous=document.activeElement;dialog.value.showModal();dialog.value.querySelector('.drop-zone button')?.focus()})
onBeforeUnmount(()=>{dialog.value?.close();previous?.focus?.()})
</script>
<style scoped>
.pdf-upload-dialog{width:min(540px,calc(100vw - 32px));max-height:calc(100dvh - 40px);border:0;border-radius:20px;padding:0;background:#fff;color:#243247;box-shadow:0 24px 90px #11223b40}.pdf-upload-dialog::backdrop{background:#14243c70;backdrop-filter:blur(3px)}form{padding:28px}header{display:flex;justify-content:space-between;gap:12px;margin-bottom:24px}.eyebrow{font-size:10px;letter-spacing:.14em;color:#7b88a0}h2{font-size:23px;margin:6px 0 8px}header p{font-size:13px;color:#78879c;margin:0}.pdf-upload-dialog button{font:inherit;font-size:13px;border:1px solid #d6deea;background:white;border-radius:9px;padding:10px 16px;cursor:pointer}.close-button{align-self:flex-start;border:0!important;font-size:23px!important;padding:0 8px!important;color:#7c8a9c}.pdf-upload-dialog button:disabled{opacity:.5;cursor:default}fieldset{border:0;margin:0;padding:0;min-width:0}.drop-zone{display:flex;flex-direction:column;align-items:center;gap:10px;border:1.5px dashed #b9c8e1;border-radius:14px;padding:26px 18px;background:#f7f9fd;text-align:center}.drop-zone.dragging,.drop-zone.selected{border-color:#6085ce;background:#f0f5ff}.file-icon{background:#e7edfa;color:#456bb2;font-size:11px;font-weight:700;padding:12px 10px;border-radius:10px}.drop-zone strong{font-size:15px;overflow-wrap:anywhere;max-width:100%}.drop-zone>span:not(.file-icon){font-size:12px;color:#7d8ba0}.drop-zone button{margin-top:4px}.title-field{display:grid;gap:8px;font-size:13px;margin-top:22px}input:not([type=file]),select{box-sizing:border-box;width:100%;font:inherit;font-size:14px;padding:11px 12px;border:1px solid #d3ddea;border-radius:9px;min-width:0}.connections{margin-top:20px;border-top:1px solid #e7ebf2;padding-top:16px}summary{cursor:pointer;display:flex;gap:10px;justify-content:space-between;font-size:12px;color:#64758e}summary>span:first-child{white-space:nowrap}summary small{font-size:10px;color:#94a0b1}.connection-summary{max-width:60%;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.connection-fields{display:grid;gap:12px;padding-top:16px}.connection-fields label{display:grid;gap:6px;font-size:12px}footer{display:flex;justify-content:flex-end;gap:9px;margin-top:26px}.primary{background:#315cbb!important;color:#fff;border-color:#315cbb!important}.upload-error{font-size:13px;color:#b03f48;line-height:1.6}.visually-hidden{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}@media(max-width:600px){form{padding:22px}h2{font-size:20px}}
</style>
