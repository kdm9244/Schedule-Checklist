<template>
  <div ref="root" class="learning-markdown" :class="{'annotated-markdown':annotations}" @click.capture="handleClick">
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
      button.textContent=`${i+1} ${count?'●':'＋'}`
      if(props.selected?.block_start===start&&props.selected?.block_source===source&&props.selected?.line_number===i+1)row.classList.add('selected')
      const text=document.createElement('span');text.className='annotation-code-text'
      text.innerHTML=DOMPurify.sanitize(language&&hljs.getLanguage(language)?hljs.highlight(line,{language}).value:hljs.highlightAuto(line).value)
      if(!line)text.textContent=' '
      row.append(button,text);return row
    }))
  }
  emit('anchors',anchors)
  observer?.observe(root.value,{childList:true,subtree:true})
}
function handleClick(event){captureCodeSource(event);const button=event.target.closest?.('.annotation-line-button');if(!button)return;const pre=button.closest('pre');const source=decodeURIComponent(pre.dataset.learningSource),line=Number(button.dataset.line);emit('select-line',{block_start:Number(pre.dataset.blockStart),block_source:source,line_number:line,line_text:source.split('\n')[line-1]||''})}
watch(()=>[props.modelValue,props.comments,props.selected],async()=>{await nextTick();decorate()},{deep:true})
onMounted(async()=>{await nextTick();if(props.annotations){observer=new MutationObserver(decorate);decorate()}})
onBeforeUnmount(()=>observer?.disconnect())
const toolbars=['bold','italic','title','quote','unorderedList','orderedList','codeRow','code','link','table','-','revoke','next','=','preview','previewOnly']
let originalCode=null
function captureCodeSource(event){const button=event.target.closest?.('.md-editor-copy-button');if(!button)return;const block=button.closest('.md-editor-code');const source=(block?.querySelector('input:checked + pre')||block?.querySelector('pre'))?.dataset.learningSource;originalCode=source===undefined?null:decodeURIComponent(source)}
const options={language:'ja-JP',previewTheme:'github',noMermaid:true,noKatex:true,noEcharts:true,codeFoldable:false,formatCopiedText:text=>originalCode??text,sanitize:html=>DOMPurify.sanitize(html,{USE_PROFILES:{html:true},FORBID_TAGS:['style','iframe','object','embed','form']})}
</script>
