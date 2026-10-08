<template>
  <div class="pdf-study" :class="{ 'study-expanded': expanded, 'pdf-only': pdfOnly }">
    <header class="study-header">
      <RouterLink to="/learning/pdf-notes" class="study-back" aria-label="PDFノート一覧へ戻る">‹</RouterLink>
      <div class="study-title"><small>PDF NOTE</small><h1>{{ note?.title || 'PDFノート' }}</h1></div>
      <div class="study-actions"><select class="layout-ratio" :value="Math.round(width)" aria-label="PDFとノートの画面比率" @change="setWidth(Number($event.target.value))"><option :value="55">PDF 55 : ノート 45</option><option :value="50">PDF 50 : ノート 50</option><option :value="65">PDF 65 : ノート 35</option><option v-if="![55,50,65].includes(Math.round(width))" :value="Math.round(width)">カスタム {{ Math.round(width) }} : {{ 100-Math.round(width) }}</option></select>
        <button :disabled="busy || !note" @click="rename">タイトル編集</button>
        <button :aria-pressed="pdfOnly" @click="pdfOnly = !pdfOnly">{{ pdfOnly ? 'ノートを表示' : 'PDFを広く読む' }}</button>
        <button :aria-pressed="expanded" @click="expanded = !expanded">{{ expanded ? '通常表示に戻る' : '集中表示' }}</button>
      </div>
    </header>
    <p v-if="error" class="study-error" role="alert">{{ error }}</p><p v-else-if="message" class="study-notice" role="status">{{ message }}</p>
    <nav class="mobile-tabs" aria-label="表示する領域">
      <button :aria-pressed="tab === 'pdf'" @click="tab = 'pdf'">PDFを読む</button>
      <button :aria-pressed="tab === 'notes'" @click="tab = 'notes'; pdfOnly = false">ノートを書く</button>
    </nav>
    <div ref="split" class="study-split" :style="{ '--left': width + '%' }">
      <section class="pdf-pane" :class="{ hiddenMobile: tab !== 'pdf' }" aria-label="PDFビューア">
        <div class="pdf-toolbar">
          <div class="page-controls">
            <button :disabled="!document || page <= 1" aria-label="前のページ" @click="page--">‹</button>
            <label><span class="sr-only">PDFページ</span><input v-model.number="page" type="number" min="1" :max="count || 1" @change="clamp" /></label>
            <span class="page-total">/ {{ count || '—' }}</span>
            <button :disabled="!document || page >= count" aria-label="次のページ" @click="page++">›</button>
          </div>
          <div class="zoom-controls">
            <button :disabled="!document" aria-label="縮小" @click="changeZoom(-25)">−</button>
            <select v-model="zoom" aria-label="PDFの表示倍率"><option value="fit">幅に合わせる</option><option v-for="n in zoomOptions" :key="n" :value="String(n)">{{ n }}%</option></select>
            <button :disabled="!document" aria-label="拡大" @click="changeZoom(25)">＋</button>
          </div>
        </div>
        <div ref="pdfScroll" class="pdf-scroll">
          <p v-if="pdfLoading" class="pdf-status" role="status">PDFを読み込み中…</p>
          <p v-if="pdfError" class="pdf-status study-error" role="alert">{{ pdfError }} <button @click="openPdf">再試行</button></p>
          <div ref="pageSurface" class="pdf-page-surface"><canvas ref="canvas" aria-label="現在のPDFページ" /><div ref="textContainer" class="pdf-text-layer" aria-label="選択できるPDFテキスト"></div></div>
        </div>
        <footer class="pdf-footer"><span>{{ Math.round(actualScale * 100) }}% · {{ page }}ページ</span><span>{{ textSelectable ? '文字をドラッグして選択・コピー' : '画像PDF · 文字は選択できません' }}</span></footer>
      </section>
      <div v-show="!pdfOnly" class="split-handle" role="separator" tabindex="0" aria-label="PDFとノートの幅を調整" aria-orientation="vertical" :aria-valuenow="Math.round(width)" :aria-valuemin="40" :aria-valuemax="80" @pointerdown="startResize" @keydown.left.prevent="setWidth(width - 2)" @keydown.right.prevent="setWidth(width + 2)"><span></span></div>
      <section v-show="!pdfOnly" class="note-pane" :class="{ hiddenMobile: tab !== 'notes' }" aria-label="ノートを書く">
        <header class="note-toolbar"><h2>ノート</h2><button :disabled="busy || !note" @click="edit(null)">＋ 新しいノート</button></header>
        <div v-if="entries.length" class="saved-notes">
          <label><span class="sr-only">保存したノート</span><select :value="selected || ''" :disabled="busy" @change="chooseEntry($event.target.value)"><option value="">新しいノート</option><option v-for="e in entries" :key="e.entry_id" :value="e.entry_id">p.{{ e.page }} · {{ e.question || '無題のノート' }}</option></select></label>
        </div>
        <form class="note-form" @submit.prevent="save">
          <fieldset :disabled="busy || !note">
            <input v-model="form.question" class="entry-title" maxlength="200" aria-label="ノートのタイトル" placeholder="タイトル・問題番号（任意）" />
            <div class="note-meta"><label>関連ページ <input v-model.number="form.page" type="number" min="1" :max="count || 100000" required /></label><button type="button" @click="form.page = page">今のページに紐づける</button></div>
            <textarea v-model="form.body" class="note-body" maxlength="200000" aria-label="ノート本文" placeholder="問題の訳、解き方、気づいたことなど、自由に書いてください。" @keydown.ctrl.s.prevent="save" @keydown.meta.s.prevent="save"></textarea>
            <footer class="note-save-bar"><div class="save-status" aria-live="polite">{{ draftMessage || '下書きはこのブラウザーに自動保存' }}<small>{{ form.body.length.toLocaleString() }}文字</small></div><div class="save-actions"><button v-if="selected" type="button" class="delete-entry" @click="remove">削除</button><button class="save-primary" :disabled="busy || !note">{{ busy ? '保存中…' : '保存' }}</button></div></footer>
          </fieldset>
        </form>
      </section>
    </div>
  </div>
</template>
<script setup>
import {computed,ref,reactive,onMounted,onBeforeUnmount,watch,nextTick,markRaw} from 'vue'
import {onBeforeRouteLeave,useRoute} from 'vue-router'
import axios from 'axios'
import {TextLayer,getDocument,GlobalWorkerOptions} from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import {API_ORIGIN} from '../utils/http'
import {pdfEntryBody,pdfEntryPayload} from '../utils/pdfNotes'
GlobalWorkerOptions.workerSrc=workerUrl
const route=useRoute(),api=axios.create({baseURL:API_ORIGIN+'/api/pdf-notes',withCredentials:true}),note=ref(null),entries=ref([]),document=ref(null),canvas=ref(null),pageSurface=ref(null),textContainer=ref(null),textSelectable=ref(true),pdfScroll=ref(null),split=ref(null),expanded=ref(false),pdfOnly=ref(false),actualScale=ref(1),page=ref(1),count=ref(0),zoom=ref('fit'),width=ref(55),tab=ref('pdf'),selected=ref(null),busy=ref(false),error=ref(''),pdfError=ref(''),pdfLoading=ref(false),message=ref(''),draftMessage=ref('')
const blank=()=>({question:'',page:page.value,body:'',status:'draft'}),form=reactive(blank())
let textLayer,resizeFrame,stopResize,resizeObserver,lastWidth=0;let owner='',restoring=false,renderTask,renderVersion=0,loadingTask,positionTimer,disposed=false,dirty=false
const base='/'+route.params.id,key=()=>`pdf-draft:${owner}:${route.params.id}:${selected.value||'new'}`
function remember(){if(restoring||!owner)return;dirty=true;try{localStorage.setItem(key(),JSON.stringify(form));draftMessage.value='下書き保存済み · 他の端末で読むには「保存」'}catch{draftMessage.value='下書きを保存できません。画面を閉じる前に保存してください。'}}
watch(form,remember,{flush:'sync'})
function edit(e){restoring=true;selected.value=e?.entry_id||null;Object.assign(form,e?{question:e.question,page:e.page,body:pdfEntryBody(e),status:e.status}:blank());try{const saved=JSON.parse(localStorage.getItem(key())||'null');if(saved){Object.assign(form,{question:saved.question||'',page:saved.page||page.value,body:pdfEntryBody(saved),status:saved.status||'draft'});draftMessage.value='この端末の下書きを復元しました。';dirty=true}else{draftMessage.value='';dirty=false}}catch{}restoring=false;if(e){page.value=e.page;clamp();tab.value='notes'}}
function clamp(){page.value=Math.max(1,Math.min(count.value||100000,Math.trunc(page.value)||1))}
async function render(){if(!document.value||!canvas.value||!pdfScroll.value?.clientWidth)return;const revision=++renderVersion;const previous=renderTask;previous?.cancel();textLayer?.cancel();try{if(previous)await previous.promise.catch(()=>{});const p=await document.value.getPage(page.value);if(revision!==renderVersion||disposed)return;const scale=zoom.value==='fit'?Math.max(0.2,(pdfScroll.value.clientWidth-24)/p.getViewport({scale:1}).width):Number(zoom.value)/100;const viewport=p.getViewport({scale});const ratio=Math.min(window.devicePixelRatio||1,3);actualScale.value=scale;canvas.value.width=Math.ceil(viewport.width*ratio);canvas.value.height=Math.ceil(viewport.height*ratio);canvas.value.style.width=viewport.width+'px';canvas.value.style.height=viewport.height+'px';pageSurface.value.style.width=viewport.width+'px';pageSurface.value.style.height=viewport.height+'px';textContainer.value.replaceChildren();textContainer.value.style.setProperty('--total-scale-factor',String(scale));renderTask=p.render({canvasContext:canvas.value.getContext('2d'),viewport,transform:ratio===1?null:[ratio,0,0,ratio,0,0]});await renderTask.promise;if(revision!==renderVersion||disposed)return;const content=await p.getTextContent();if(revision!==renderVersion||disposed)return;textSelectable.value=content.items.some(i=>i.str?.trim());textLayer=new TextLayer({textContentSource:content,container:textContainer.value,viewport});await textLayer.render()}catch(e){if(!['RenderingCancelledException','AbortException'].includes(e.name)&&!disposed)pdfError.value='ページを表示できません。'}}
async function openPdf(){await loadingTask?.destroy();pdfError.value='';pdfLoading.value=true;try{loadingTask=getDocument({url:API_ORIGIN+'/api/pdf-notes'+base+'/file',withCredentials:true,isEvalSupported:false});const doc=await loadingTask.promise;if(disposed){await doc.destroy();return}document.value=markRaw(doc);count.value=doc.numPages;clamp();await nextTick();await render()}catch(e){if(!disposed)pdfError.value='PDFを開けません。破損・パスワード保護・保存ファイルを確認してください。'}finally{pdfLoading.value=false}}
watch(page,()=>{clamp();pdfScroll.value?.scrollTo({top:0,left:0});render();clearTimeout(positionTimer);if(note.value)positionTimer=setTimeout(()=>api.patch(base,{last_page:page.value}).catch(()=>{error.value='読んだ位置を保存できませんでした。'}),500)})
async function save(){if(busy.value)return;busy.value=true;error.value='';try{if(count.value&&form.page>count.value)throw Error('PDFのページ範囲内で指定してください。');const payload=pdfEntryPayload(form);const {data}=selected.value?await api.put(base+'/entries/'+selected.value,payload):await api.post(base+'/entries',payload);try{localStorage.removeItem(key())}catch{}const i=entries.value.findIndex(e=>e.entry_id===data.entry_id);if(i<0)entries.value.push(data);else entries.value[i]=data;entries.value.sort((a,b)=>a.page-b.page||Number(a.entry_id)-Number(b.entry_id));selected.value=data.entry_id;dirty=false;draftMessage.value='保存しました。'}catch(e){error.value=e.response?.data?.message||e.message}finally{busy.value=false}}
async function remove(){if(!confirm('このノートと下書きを削除しますか？'))return;busy.value=true;try{await api.delete(base+'/entries/'+selected.value);localStorage.removeItem(key());entries.value=entries.value.filter(e=>e.entry_id!==selected.value);restoring=true;selected.value=null;Object.assign(form,blank());restoring=false;dirty=false;draftMessage.value='削除しました。'}catch(e){error.value=e.response?.data?.message||e.message}finally{busy.value=false}}
async function rename(){const title=prompt('PDFノートのタイトル',note.value.title);if(title===null)return;busy.value=true;try{await api.patch(base,{title});note.value.title=title.trim()}catch(e){error.value=e.response?.data?.message||e.message}finally{busy.value=false}}
function unload(e){if(dirty){e.preventDefault();e.returnValue=''}}
onBeforeRouteLeave(()=>busy.value?false:!dirty||confirm('未保存のノートがあります。この端末の下書きとして残して移動しますか？'))
onMounted(async()=>{window.addEventListener('beforeunload',unload);window.addEventListener('keydown',escape);try{owner=String((await axios.get(API_ORIGIN+'/api/users/me',{withCredentials:true})).data.userId);try{const saved=Number(localStorage.getItem('pdf-layout:'+owner+':'+route.params.id));if(Number.isFinite(saved)&&saved>=40&&saved<=80)width.value=saved}catch{}const {data}=await api.get(base);note.value=data.note;entries.value=data.entries;page.value=data.note.last_page;edit(null);await openPdf();resizeObserver=new ResizeObserver(()=>{const w=pdfScroll.value?.clientWidth;if(w>0&&w!==lastWidth){lastWidth=w;if(zoom.value==='fit'){cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(render)}}});if(canvas.value)resizeObserver.observe(pdfScroll.value)}catch(e){error.value=e.response?.data?.message||e.message}})
onBeforeUnmount(()=>{disposed=true;cancelAnimationFrame(resizeFrame);stopResize?.();window.removeEventListener('keydown',escape);resizeObserver?.disconnect();clearTimeout(positionTimer);renderTask?.cancel();textLayer?.cancel();loadingTask?.destroy();window.removeEventListener('beforeunload',unload)})

const zoomOptions=computed(()=>[...new Set([75,100,125,150,175,200,250,300,...(zoom.value==='fit'?[]:[Number(zoom.value)])])].sort((a,b)=>a-b))
function chooseEntry(value){edit(entries.value.find(e=>String(e.entry_id)===value)||null)}
function changeZoom(delta){zoom.value=String(Math.max(50,Math.min(300,Math.round(actualScale.value*100/25)*25+delta)))}
watch(zoom,render)
watch([tab,pdfOnly,expanded],async()=>{await nextTick();render()})
function escape(e){if(e.key==='Escape'){expanded.value=false;pdfOnly.value=false}}
function setWidth(value){const available=split.value?.clientWidth||1000;const maximum=Math.min(80,100-300/available*100);width.value=Math.max(40,Math.min(maximum,value));if(owner)try{localStorage.setItem('pdf-layout:'+owner+':'+route.params.id,String(width.value))}catch{}}
function startResize(e){
 if(e.button!==0)return
 e.preventDefault();stopResize?.()
 const move=e=>{const rect=split.value.getBoundingClientRect();setWidth((e.clientX-rect.left)/rect.width*100)}
 stopResize=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',stopResize);window.removeEventListener('pointercancel',stopResize)}
 window.addEventListener('pointermove',move);window.addEventListener('pointerup',stopResize);window.addEventListener('pointercancel',stopResize)
}

</script>
<style scoped>
.pdf-study{height:calc(100dvh - 56px);min-height:480px;display:flex;flex-direction:column;gap:12px;color:#243247}
.study-expanded{position:fixed;inset:0;z-index:1000;height:100dvh;min-height:0;padding:14px 18px;box-sizing:border-box;background:#eef1f5}
.study-header{display:flex;align-items:center;gap:12px;flex-shrink:0;min-height:48px}
.study-back{font-size:28px;text-decoration:none;color:#58677d;padding:4px 10px;border-radius:10px;background:#fff}
.study-title{min-width:0;flex:1}.study-title small{font-size:10px;letter-spacing:.12em;color:#758196}.study-title h1{font-size:20px;margin:2px 0;line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.study-actions{display:flex;gap:6px}.pdf-study button,.pdf-study select{font:inherit;font-size:13px;min-height:34px;border:1px solid #dce2ea;border-radius:8px;background:#fff;color:#33435a;padding:6px 10px;cursor:pointer}
.pdf-study button:disabled{opacity:.45;cursor:default}.pdf-study button[aria-pressed=true]{background:#e8efff;border-color:#a8bce9;color:#2859b1}
.study-split{flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,var(--left)) 12px minmax(0,1fr)}
.pdf-only .study-split{grid-template-columns:minmax(0,1fr)}
.pdf-pane,.note-pane{min-width:0;min-height:0;background:#fff;border:1px solid #dce2ea;border-radius:12px;overflow:hidden;display:flex;flex-direction:column}
.pdf-toolbar{display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;padding:10px 12px;border-bottom:1px solid #e4e8ef;flex-shrink:0}
.page-controls,.zoom-controls{display:flex;align-items:center;gap:5px}.page-controls input{width:56px;height:34px;box-sizing:border-box;text-align:center;border:1px solid #dce2ea;border-radius:7px;font:inherit;font-size:14px}.page-total{font-size:13px;color:#68778c;white-space:nowrap}.zoom-controls select{max-width:132px}
.pdf-scroll{flex:1;min-height:0;overflow:auto;padding:12px;box-sizing:border-box;background:#dfe4eb;overscroll-behavior:contain;scrollbar-gutter:stable}
canvas{display:block;margin:0 auto;background:#fff;box-shadow:0 3px 16px #2432471f}
.pdf-footer{display:flex;justify-content:space-between;gap:12px;padding:7px 12px;font-size:11px;color:#6c7890;border-top:1px solid #e4e8ef}
.study-notice{margin:0;color:#3e7863;font-size:13px}.pdf-status{padding:16px;line-height:1.7}.study-error{margin:0;color:#ae3040;font-size:13px}
.split-handle{cursor:col-resize;display:flex;justify-content:center;align-items:center;touch-action:none;outline-offset:-2px}.split-handle span{width:3px;height:48px;background:#b5c1d1;border-radius:4px}.split-handle:hover span,.split-handle:focus span{background:#4d7ac8}
.note-toolbar{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:12px 16px;border-bottom:1px solid #e4e8ef}.note-toolbar h2{margin:0;font-size:16px}.saved-notes{padding:10px 16px 0}.saved-notes select{width:100%;text-overflow:ellipsis}.saved-notes label{display:block}
.note-form{flex:1;min-height:0;display:flex}.note-form fieldset{border:0;padding:16px;margin:0;min-width:0;flex:1;min-height:0;display:flex;flex-direction:column;gap:8px}
.entry-title{width:100%;box-sizing:border-box;border:0;border-bottom:1px solid #e4e8ef;border-radius:0;padding:2px 0 7px;font:inherit;font-size:18px;font-weight:600;background:transparent;color:#243247}
.note-meta{display:flex;align-items:center;flex-wrap:wrap;gap:6px;font-size:11px;color:#6b7890}.note-meta label{display:flex;align-items:center;gap:6px}.note-meta input{width:52px;border:1px solid #dce2ea;border-radius:7px;padding:4px;font:inherit}.note-meta button{font-size:11px;min-height:28px;padding:4px 7px}
.note-body{flex:1;min-height:120px;width:100%;box-sizing:border-box;border:0;resize:none;font:inherit;font-size:17px;line-height:1.9;padding:8px 2px;color:#26364c;background:#fff;outline-offset:3px}.note-body::placeholder{font-size:15px;color:#929db0}
.note-save-bar{display:flex;align-items:center;justify-content:space-between;gap:8px;border-top:1px solid #e4e8ef;padding-top:12px;flex-shrink:0}.save-status{font-size:11px;line-height:1.5;color:#77849a}.save-status small{display:block;font-size:10px}.save-actions{display:flex;gap:6px}.pdf-study .save-primary{background:#315fba;color:#fff;border-color:#315fba;padding-inline:18px}.pdf-study .delete-entry{color:#a73c48;border-color:transparent}
.mobile-tabs{display:none}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap}
@media(max-width:1000px){.study-title h1{font-size:17px}.study-actions button{font-size:11px;padding:5px 7px}.study-actions button:first-of-type{display:none}.pdf-toolbar{padding:8px}.note-form fieldset{padding:12px}}
@media(max-width:850px){.pdf-study{height:calc(100dvh - 100px);min-height:420px}.study-expanded{height:100dvh;min-height:0;padding:10px}.study-header{gap:8px}.study-title small{display:none}.study-actions button:nth-of-type(2){display:none}.layout-ratio{display:none}.mobile-tabs{display:flex;gap:8px;flex-shrink:0}.study-split{display:flex}.pdf-pane,.note-pane{flex:1}.hiddenMobile{display:none!important}.split-handle{display:none}.pdf-footer span:last-child{display:none}.note-body{font-size:16px}.study-title h1{max-width:180px}.pdf-toolbar{gap:6px}.zoom-controls select{max-width:115px}}
.pdf-page-surface{position:relative;margin:0 auto;flex-shrink:0;background:white}.pdf-text-layer{position:absolute;inset:0;overflow:clip;line-height:1;letter-spacing:normal;word-spacing:normal;text-align:initial;transform-origin:0 0;text-size-adjust:none;--scale-round-x:1px;--scale-round-y:1px;--min-font-size:1;--text-scale-factor:calc(var(--total-scale-factor)*var(--min-font-size));--min-font-size-inv:calc(1/var(--min-font-size));user-select:text}.pdf-text-layer :deep(span),.pdf-text-layer :deep(br){position:absolute;color:transparent;white-space:pre;cursor:text;transform-origin:0% 0%;user-select:text}.pdf-text-layer :deep(span){font-size:calc(var(--text-scale-factor)*var(--font-height));transform:rotate(var(--rotate,0deg)) scaleX(var(--scale-x,1)) scale(var(--min-font-size-inv))}.pdf-text-layer :deep(.markedContent){display:contents}.pdf-text-layer :deep(span::selection){background:#4887e866;color:transparent}.pdf-text-layer[data-main-rotation="90"]{transform:rotate(90deg) translateY(-100%)}.pdf-text-layer[data-main-rotation="180"]{transform:rotate(180deg) translate(-100%,-100%)}.pdf-text-layer[data-main-rotation="270"]{transform:rotate(270deg) translateX(-100%)}
</style>
