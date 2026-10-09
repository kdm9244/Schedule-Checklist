<template>
 <div class="rich-note-editor" :class="{disabled}">
  <div class="tiptap-toolbar" role="toolbar" aria-label="本文の書式" @keydown="toolbarKeys">
   <div class="tiptap-toolbar-group">
    <button type="button" class="tt-button" :disabled="disabled||!editor?.can().undo()" title="元に戻す（Ctrl+Z）" aria-label="元に戻す" @mousedown.prevent @click="editor.chain().focus().undo().run()"><TiptapUiIcon name="undo" /></button>
    <button type="button" class="tt-button" :disabled="disabled||!editor?.can().redo()" title="やり直す（Ctrl+Shift+Z）" aria-label="やり直す" @mousedown.prevent @click="editor.chain().focus().redo().run()"><TiptapUiIcon name="redo" /></button>
   </div>
   <span class="tiptap-separator" role="separator"></span>
   <button type="button" class="tt-button" :disabled="disabled||!editor" :aria-pressed="editor?.isActive('bold')||false" title="太字（Ctrl+B）" aria-label="太字" @mousedown.prevent @click="editor.chain().focus().toggleBold().run()"><TiptapUiIcon name="bold" /></button>
   <div class="tiptap-toolbar-group">
    <PopoverRoot v-model:open="textPaletteOpen" @update:open="paletteOpened('text',$event)">
     <PopoverTrigger as-child><button type="button" class="tt-button tt-color-trigger" :disabled="disabled||!editor" aria-label="文字色を選ぶ" title="文字色" @mousedown.prevent="captureSelection"><span class="text-color-glyph" :style="{'--indicator':activeColor('textStyle')||'#26364c'}">A</span><TiptapUiIcon name="chevron" class="chevron-icon" /><span class="sr-only">文字色</span></button></PopoverTrigger>
     <PopoverPortal><PopoverContent class="tiptap-color-popover" aria-label="文字色のパレット" align="start" :side-offset="8" :collision-padding="12" @close-auto-focus="closeFocus" @escape-key-down="stopEscape">
      <div class="palette-title"><strong>文字色</strong><span>{{ colorName('textStyle') }}</span></div>
      <div class="color-swatch-grid" role="group" aria-label="文字色" @keydown="paletteKeys">
       <button v-for="c in colors" :key="c.value" type="button" class="color-swatch text-swatch" :aria-label="c.name+'の文字色'" :aria-pressed="activeColor('textStyle')===c.value" :title="c.name" :style="{'--swatch-color':c.value}" @click="applyPalette('text',c.value)"><span>A</span><svg v-if="activeColor('textStyle')===c.value" viewBox="0 0 16 16" aria-hidden="true"><path d="m3 8 3 3 7-7" fill="none" stroke="currentColor" stroke-width="2"/></svg></button>
      </div>
      <button class="palette-reset" type="button" @click="applyPalette('text',null)">文字色をリセット</button>
     </PopoverContent></PopoverPortal>
    </PopoverRoot>
    <PopoverRoot v-model:open="highlightPaletteOpen" @update:open="paletteOpened('highlight',$event)">
     <PopoverTrigger as-child><button type="button" class="tt-button tt-color-trigger" :disabled="disabled||!editor" aria-label="蛍光ペンの色を選ぶ" title="蛍光ペン" @mousedown.prevent="captureSelection"><span class="highlight-color-glyph" :style="{'--indicator':activeColor('highlight')||'#fff2a8'}"><TiptapUiIcon name="highlighter" /></span><TiptapUiIcon name="chevron" class="chevron-icon" /><span class="sr-only">蛍光ペン</span></button></PopoverTrigger>
     <PopoverPortal><PopoverContent class="tiptap-color-popover" aria-label="蛍光ペンのパレット" align="start" :side-offset="8" :collision-padding="12" @close-auto-focus="closeFocus" @escape-key-down="stopEscape">
      <div class="palette-title"><strong>蛍光ペン</strong><span>{{ colorName('highlight') }}</span></div>
      <div class="color-swatch-grid" role="group" aria-label="蛍光ペンの色" @keydown="paletteKeys">
       <button v-for="c in highlights" :key="c.value" type="button" class="color-swatch highlight-swatch" :aria-label="c.name+'の蛍光ペン'" :aria-pressed="activeColor('highlight')===c.value" :title="c.name" :style="{'--swatch-color':c.value}" @click="applyPalette('highlight',c.value)"><span></span><svg v-if="activeColor('highlight')===c.value" viewBox="0 0 16 16" aria-hidden="true"><path d="m3 8 3 3 7-7" fill="none" stroke="currentColor" stroke-width="2"/></svg></button>
      </div>
      <button class="palette-reset" type="button" @click="applyPalette('highlight',null)">蛍光ペンを解除</button>
     </PopoverContent></PopoverPortal>
    </PopoverRoot>
   </div>
   <span class="tiptap-separator" role="separator"></span>
   <button type="button" class="tt-button" :disabled="disabled||!editor" title="選択した文字の書式をクリア" aria-label="書式をクリア" @mousedown.prevent @click="editor.chain().focus().unsetAllMarks().run()"><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m16 3 5 5-10 10H6l-4-4L13 3h3Z M8 8l8 8 M10 21h11"/></svg></button>
  </div>
  <EditorContent :editor="editor" class="rich-content" :class="{empty:!characters}" />
 </div>
</template>
<script setup>
import {onBeforeUnmount,ref,watch} from 'vue'
import {useEditor,EditorContent} from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import {TextStyle,Color} from '@tiptap/extension-text-style'
import Highlight from '@tiptap/extension-highlight'
import DOMPurify from 'dompurify'
import {PopoverRoot,PopoverTrigger,PopoverPortal,PopoverContent} from 'reka-ui'
import TiptapUiIcon from './tiptap-ui/TiptapUiIcon.vue'
const props=defineProps({modelValue:{type:String,default:''},format:{type:String,default:'plain'},disabled:Boolean})
const emit=defineEmits(['update:modelValue','update:format','characters','save'])
const colors=[{name:'通常',value:'#26364c'},{name:'赤',value:'#d33b45'},{name:'青',value:'#315cbb'},{name:'緑',value:'#238268'},{name:'紫',value:'#8a4db5'},{name:'オレンジ',value:'#c06d18'}]
const highlights=[{name:'黄色',value:'#fff2a8'},{name:'ピンク',value:'#ffd6df'},{name:'水色',value:'#cfe4ff'},{name:'緑',value:'#d4f0db'},{name:'紫',value:'#e5d9fa'}]
const characters=ref(0)
function content(){
 if(props.format==='richtext'){
  const container=window.document.createElement('div')
  container.innerHTML=DOMPurify.sanitize(props.modelValue,{ALLOWED_TAGS:['p','br','strong','b','span','mark'],ALLOWED_ATTR:['style','data-color']})
  for(const element of container.querySelectorAll('[style],[data-color]')){
   const mark=element.tagName==='MARK',property=mark?'background-color':'color'
   const value=hexColor(element.style.getPropertyValue(property)||element.getAttribute('data-color')||'')
   element.removeAttribute('style');element.removeAttribute('data-color')
   if((mark?highlights:colors).some(c=>c.value===value)&&['SPAN','MARK'].includes(element.tagName)){
    element.style.setProperty(property,value);if(mark)element.setAttribute('data-color',value)
   }
  }
  return container.innerHTML
 }
 return props.modelValue.split('\n').map(line=>'<p>'+line.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')+'</p>').join('')
}
function count(value){characters.value=value.getText().length;emit('characters',characters.value)}
const editor=useEditor({
 content:content(),editable:!props.disabled,
 extensions:[StarterKit.configure({heading:false,bulletList:false,orderedList:false,listItem:false,code:false,codeBlock:false,blockquote:false,horizontalRule:false,italic:false,strike:false,underline:false,link:false}),TextStyle,Color,Highlight.configure({multicolor:true})],
 editorProps:{attributes:{role:'textbox','aria-label':'ノート本文','aria-multiline':'true',class:'pdf-writing-content'},handleKeyDown:(_,event)=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'){event.preventDefault();emit('save');return true}return false}},
 onCreate:({editor:value})=>count(value),
 onUpdate:({editor:value})=>{emit('update:format','richtext');emit('update:modelValue',value.getHTML());count(value)},
})
watch(()=>[props.modelValue,props.format],()=>{if(!editor.value)return;if(props.format==='richtext'&&props.modelValue===editor.value.getHTML())return;const html=content();if(editor.value.getHTML()!==html){editor.value.commands.setContent(html,{emitUpdate:false});count(editor.value)}})
watch(()=>props.disabled,value=>editor.value?.setEditable(!value,false))
function hexColor(value){value=value.toLowerCase();const rgb=value.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/);return rgb?'#'+rgb.slice(1).map(n=>Number(n).toString(16).padStart(2,'0')).join(''):value}
function activeColor(mark){return hexColor(editor.value?.getAttributes(mark).color||'')}
onBeforeUnmount(()=>editor.value?.destroy())

const textPaletteOpen=ref(false),highlightPaletteOpen=ref(false)
let selectedRange=null,paletteCommitted=false
function captureSelection(){if(editor.value){const {from,to}=editor.value.state.selection;selectedRange={from,to}}}
function paletteOpened(type,open){if(open){captureSelection();paletteCommitted=false;if(type==='text')highlightPaletteOpen.value=false;else textPaletteOpen.value=false}}
function colorName(mark){const value=activeColor(mark),list=mark==='highlight'?highlights:colors;return list.find(c=>c.value===value)?.name||'未指定'}
function applyPalette(type,value){
 if(!editor.value||props.disabled)return
 const chain=editor.value.chain().focus()
 if(selectedRange)chain.setTextSelection(selectedRange)
 if(type==='text'){if(value)chain.setColor(value);else chain.unsetColor()}
 else{if(value)chain.setHighlight({color:value});else chain.unsetHighlight()}
 paletteCommitted=true;chain.run();textPaletteOpen.value=false;highlightPaletteOpen.value=false
}
function closeFocus(event){if(paletteCommitted){event.preventDefault();paletteCommitted=false}}
function stopEscape(event){event.stopPropagation()}
function toolbarKeys(event){
 if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return
 const buttons=[...event.currentTarget.querySelectorAll('button:not(:disabled)')],index=buttons.indexOf(window.document.activeElement)
 if(index<0||!buttons.length)return
 event.preventDefault();buttons[event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length]?.focus()
}
function paletteKeys(event){
 if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key))return
 const buttons=[...event.currentTarget.querySelectorAll('button')],index=buttons.indexOf(window.document.activeElement)
 if(index<0||!buttons.length)return
 const delta={ArrowLeft:-1,ArrowRight:1,ArrowUp:-6,ArrowDown:6}[event.key]||0
 event.preventDefault();buttons[event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+delta+buttons.length)%buttons.length]?.focus()
}
watch(()=>props.disabled,value=>{if(value){textPaletteOpen.value=false;highlightPaletteOpen.value=false}})

</script>
<style scoped>
/* Toolbar grouping and ghost-button sizing adapted from the official Tiptap
   Simple Editor. Official icons and MIT notice live in ./tiptap-ui/. */
.rich-note-editor{position:relative;display:flex;flex-direction:column;flex:1;min-height:120px;min-width:0}
.tiptap-toolbar{display:flex;align-items:center;gap:4px;flex-wrap:nowrap;min-height:44px;flex-shrink:0;padding:0 2px 8px;border-bottom:1px solid #e7e9ee}
.tiptap-toolbar-group{display:flex;align-items:center;gap:2px}
.tiptap-separator{height:20px;width:1px;background:#e4e5e9;margin:0 5px;flex-shrink:0}
.tt-button{appearance:none;display:inline-flex;align-items:center;justify-content:center;gap:3px;min-width:32px;height:32px;padding:6px;border:0;border-radius:6px;background:transparent;color:#444852;cursor:pointer;font:inherit;flex-shrink:0;line-height:1}
.tt-button:hover:not(:disabled){background:#f0f1f4;color:#20232b}.tt-button[aria-pressed=true],.tt-button[data-state=open]{background:#e9ecf2;color:#1e2532}.tt-button:focus-visible{outline:2px solid #8aa8df;outline-offset:2px}.tt-button:disabled{opacity:.3;cursor:default}
.tt-color-trigger{padding-inline:7px}.tt-color-trigger :deep(.chevron-icon){width:12px;height:12px;color:#7c808a}
.text-color-glyph{display:flex;align-items:center;justify-content:center;width:18px;height:21px;font-family:Georgia,serif;font-weight:700;font-size:19px;position:relative;padding-bottom:3px;box-sizing:border-box}
.text-color-glyph::after,.highlight-color-glyph::after{content:'';position:absolute;bottom:0;left:1px;right:1px;height:3px;background:var(--indicator);border-radius:2px}
.highlight-color-glyph{position:relative;display:inline-flex;height:22px;align-items:flex-start}
:global(.tiptap-color-popover){box-sizing:border-box;z-index:1500;width:258px;max-width:calc(100vw - 24px);padding:14px;background:#fff;border:1px solid #e4e5eb;border-radius:12px;color:#303540;box-shadow:0 8px 24px #17213316,0 1px 4px #1721330d;font-family:inherit;outline:none}
.palette-title{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px}.palette-title strong{font-size:13px;font-weight:600}.palette-title>span{font-size:11px;color:#8b909a}
.color-swatch-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:5px;padding-bottom:13px}
.color-swatch{appearance:none;position:relative;display:grid;place-items:center;width:32px;height:32px;padding:3px;border:1px solid #e7e9ee;border-radius:7px;background:#fff;cursor:pointer;font:inherit}
.color-swatch:hover{border-color:#939aa9;box-shadow:0 0 0 2px #edf0f6}.color-swatch:focus-visible{outline:2px solid #7c9ddb;outline-offset:2px}.color-swatch[aria-pressed=true]{border-color:#9aa3b4;background:#f4f6fa}
.text-swatch>span{color:var(--swatch-color);font-family:Georgia,serif;font-size:21px;font-weight:700}.highlight-swatch>span{width:24px;height:24px;display:block;background:var(--swatch-color);border-radius:4px;border:1px solid #00000008}.color-swatch>svg{position:absolute;right:-3px;bottom:-3px;width:13px;height:13px;padding:1px;box-sizing:border-box;color:#354569;background:#fff;border:1px solid #c7cedb;border-radius:50%}
.palette-reset{appearance:none;display:flex;align-items:center;width:100%;padding:9px 8px;border:0;border-top:1px solid #edf0f5;border-radius:0 0 5px 5px;background:#fff;font:inherit;font-size:12px;color:#717986;cursor:pointer;text-align:left}.palette-reset:hover{background:#f5f6f9;color:#2b3343}
.rich-content{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain}.rich-content :deep(.pdf-writing-content){min-height:100%;box-sizing:border-box;padding:18px 2px;outline:none;font-size:17px;line-height:1.9;color:#26364c;overflow-wrap:anywhere;white-space:pre-wrap}.rich-content :deep(p){margin:0 0 .65em}.rich-content :deep(mark){padding:0;border-radius:2px}.rich-content.empty :deep(p:first-child)::before{content:'問題の訳、解き方、気づいたことなど、自由に書いてください。';float:left;height:0;color:#929db0;pointer-events:none;font-size:14px}.disabled .rich-content{opacity:.7}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap}
@media(max-width:600px){.tiptap-toolbar{gap:2px}.tiptap-separator{margin:0 3px}.rich-content :deep(.pdf-writing-content){font-size:16px}}
</style>
