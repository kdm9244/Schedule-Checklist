<template>
  <div ref="root" class="learning-markdown" :class="{'annotated-markdown':annotations}" @click.capture="handleClick" @pointerdown="startRange" @pointerover="hoverComment" @pointerout="leaveComment">
    <div v-if="range" class="code-range-action" :style="{top:rangeTop+'px'}"><span>{{ range.line_number }}–{{ range.end_line }}行</span><button type="button" @click="emit('select-line',range)">＋ コメント</button><button type="button" aria-label="選択を解除" @click="range=null;paintRange()">×</button></div>
    <MdPreview v-if="readonly" :id="id" :model-value="modelValue" v-bind="options" />
    <MdEditor v-else :id="id" :model-value="modelValue" v-bind="options" :preview="true" :toolbars="toolbars" :footers="['markdownTotal','scrollAuto']" :no-prettier="true" placeholder="学んだことやコードを Markdown で記録しましょう。" @update:model-value="$emit('update:modelValue',$event)" @on-save="$emit('save')" />
  </div>
</template>
<script setup>
import { MdEditor,MdPreview,config } from 'md-editor-v3'
import {ref,watch,nextTick,onMounted,onBeforeUnmount} from 'vue'
import Japanese from '@vavt/cm-extension/dist/locale/jp-JP'
import DOMPurify from 'dompurify'
import hljs from 'highlight.js/lib/core'
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import python from 'highlight.js/lib/languages/python'
import java from 'highlight.js/lib/languages/java'
import sql from 'highlight.js/lib/languages/sql'
import xml from 'highlight.js/lib/languages/xml'
import css from 'highlight.js/lib/languages/css'
import json from 'highlight.js/lib/languages/json'
import bash from 'highlight.js/lib/languages/bash'
import 'md-editor-v3/lib/style.css'
import 'highlight.js/styles/github.css'
for(const [name,language] of Object.entries({javascript,typescript,python,java,sql,xml,css,json,bash}))hljs.registerLanguage(name,language)
config({editorExtensions:{highlight:{instance:hljs}},editorConfig:{languageUserDefined:{'ja-JP':{...Japanese,toolbarTips:{...Japanese.toolbarTips,previewOnly:'プレビューのみ'}}}},markdownItConfig:md=>{
  md.set({html:false})
  // md-editor trims empty code lines for display. Retain parser source for exact copying.
  for(const name of ['fence','code_block']) {
    const renderer=md.renderer.rules[name]
    md.renderer.rules[name]=(tokens,index,...args)=>renderer(tokens,index,...args).replace('<pre',`<pre data-block-start="${tokens[index].map?.[0]??index}" data-learning-source="${encodeURIComponent(tokens[index].content)}"`)
  }
}})
const props=defineProps({modelValue:{type:String,default:''},readonly:Boolean,id:{type:String,default:'learning-markdown'},annotations:Boolean,comments:{type:Array,default:()=>[]},selected:Object})
const emit=defineEmits(['update:modelValue','save','select-line','anchors'])
const root=ref(null)
const range=ref(null),rangeTop=ref(0)
let drag=null,suppressClick=false
function makeRange(pre,from,to){const source=decodeURIComponent(pre.dataset.learningSource),lines=source.replace(/\n$/,'').split('\n');const first=Math.min(from,to),last=Math.max(from,to);return {block_start:Number(pre.dataset.blockStart),block_source:source,line_number:first,end_line:last,line_text:lines.slice(first-1,last).join('\n')}}
function paintRange(){if(!root.value)return;for(const pre of root.value.querySelectorAll('pre[data-learning-source]')){const same=range.value&&Number(pre.dataset.blockStart)===range.value.block_start&&decodeURIComponent(pre.dataset.learningSource)===range.value.block_source;for(const row of pre.querySelectorAll('.annotation-code-line')){const n=Number(row.querySelector('button')?.dataset.line);row.classList.toggle('range-selected',!!same&&n>=range.value.line_number&&n<=range.value.end_line);if(same&&n===range.value.end_line)rangeTop.value=row.getBoundingClientRect().bottom-root.value.getBoundingClientRect().top}}}
function startRange(event){const button=event.target.closest?.('.annotation-line-button');if(!button||event.button!==0||event.target.closest('.line-comment-marker'))return;event.preventDefault();const pre=button.closest('pre');drag={pre,from:Number(button.dataset.line),to:Number(button.dataset.line),pointer:event.pointerId};range.value=makeRange(pre,drag.from,drag.to);paintRange()}
function commentRange(marker){const pre=marker.closest('pre'),line=Number(marker.closest('button').dataset.line),source=decodeURIComponent(pre.dataset.learningSource),start=Number(pre.dataset.blockStart);const comments=props.comments.filter(c=>c.block_start===start&&c.block_source===source&&c.line_number===line);return makeRange(pre,line,Math.max(line,...comments.map(c=>c.end_line||c.line_number)))}
function clearHover(){root.value?.querySelectorAll('.comment-hover').forEach(row=>row.classList.remove('comment-hover'))}
function hoverComment(event){const marker=event.target.closest?.('.line-comment-marker');if(!marker||drag)return;const target=commentRange(marker),pre=marker.closest('pre');clearHover();for(const row of pre.querySelectorAll('.annotation-code-line')){const line=Number(row.querySelector('button')?.dataset.line);row.classList.toggle('comment-hover',line>=target.line_number&&line<=target.end_line)}}
function leaveComment(event){const marker=event.target.closest?.('.line-comment-marker');if(marker&&!marker.contains(event.relatedTarget))clearHover()}
function moveRange(event){if(!drag||event.pointerId!==drag.pointer)return;const button=document.elementFromPoint(event.clientX,event.clientY)?.closest('.annotation-line-button');if(button?.closest('pre')!==drag.pre)return;drag.to=Number(button.dataset.line);range.value=makeRange(drag.pre,drag.from,drag.to);paintRange()}
function finishRange(event){if(!drag||event.pointerId!==drag.pointer)return;const current=drag;drag=null;if(event.type==='pointercancel'){range.value=null;paintRange();return}suppressClick=!!event.target.closest?.('.annotation-line-button');if(current.from===current.to&&event.target.closest?.('.line-comment-dot'))emit('select-line',range.value)}
let observer
function decorate(){
  if(!props.annotations||!props.readonly||!root.value)return
  observer?.disconnect()
  const anchors=[]
  for(const pre of root.value.querySelectorAll('pre[data-learning-source]')){
    const source=decodeURIComponent(pre.dataset.learningSource),start=Number(pre.dataset.blockStart)
    const code=pre.querySelector('code');if(!code)continue
    const lines=source.replace(/\n$/,'').split('\n')
    const language=[...code.classList].find(c=>c.startsWith('language-'))?.slice(9)
    code.replaceChildren(...lines.map((line,i)=>{
      anchors.push({block_start:start,block_source:source,line_number:i+1,line_text:line})
      const row=document.createElement('span');row.className='annotation-code-line'
      const button=document.createElement('button');button.type='button';button.className='annotation-line-button';button.dataset.line=String(i+1);button.setAttribute('aria-label',`${i+1}行目にコメントを追加`)
      const count=props.comments.filter(c=>c.block_start===start&&c.block_source===source&&c.line_number===i+1).length
      const number=document.createElement('span');number.textContent=String(i+1)
      const indicator=document.createElement('span');indicator.className=count?'line-comment-marker':'line-comment-plus'
      if(count){indicator.innerHTML='<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-5 3V6a2 2 0 0 1 1-2Z" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>';indicator.title=`コメント ${count}件`;if(count>1){const badge=document.createElement('small');badge.textContent=String(count);indicator.append(badge)}}else indicator.textContent='＋'
      if(count)button.setAttribute('aria-label',`${i+1}行目のコメント${count}件を表示`)
      button.append(number,indicator)
      if(props.selected?.block_start===start&&props.selected?.block_source===source&&props.selected?.line_number<=i+1&&(props.selected.end_line||props.selected.line_number)>=i+1)row.classList.add('selected')
      const text=document.createElement('span');text.className='annotation-code-text'
      text.innerHTML=DOMPurify.sanitize(language&&hljs.getLanguage(language)?hljs.highlight(line,{language}).value:hljs.highlightAuto(line).value)
      if(!line)text.textContent=' '
      row.append(button,text);return row
    }))
  }
  emit('anchors',anchors)
  paintRange()
  observer?.observe(root.value,{childList:true,subtree:true})
}
function handleClick(event){captureCodeSource(event);const button=event.target.closest?.('.annotation-line-button');if(!button)return;const marker=event.target.closest('.line-comment-marker');if(marker){suppressClick=false;range.value=null;clearHover();paintRange();emit('select-line',commentRange(marker));return}if(suppressClick){suppressClick=false;return}const pre=button.closest('pre');range.value=makeRange(pre,Number(button.dataset.line),Number(button.dataset.line));paintRange()}
watch(()=>[props.modelValue,props.comments,props.selected],async()=>{await nextTick();decorate()},{deep:true})
onMounted(async()=>{await nextTick();if(props.annotations){observer=new MutationObserver(decorate);decorate();window.addEventListener('pointermove',moveRange);window.addEventListener('pointerup',finishRange);window.addEventListener('pointercancel',finishRange)}})
onBeforeUnmount(()=>{observer?.disconnect();window.removeEventListener('pointermove',moveRange);window.removeEventListener('pointerup',finishRange);window.removeEventListener('pointercancel',finishRange)})
const toolbars=['bold','italic','title','quote','unorderedList','orderedList','codeRow','code','link','table','-','revoke','next','=','preview','previewOnly']
let originalCode=null
function captureCodeSource(event){const button=event.target.closest?.('.md-editor-copy-button');if(!button)return;const block=button.closest('.md-editor-code');const source=(block?.querySelector('input:checked + pre')||block?.querySelector('pre'))?.dataset.learningSource;originalCode=source===undefined?null:decodeURIComponent(source)}
const options={language:'ja-JP',previewTheme:'github',noMermaid:true,noKatex:true,noEcharts:true,codeFoldable:false,formatCopiedText:text=>originalCode??text,sanitize:html=>DOMPurify.sanitize(html,{USE_PROFILES:{html:true},FORBID_TAGS:['style','iframe','object','embed','form']})}
</script>
