<template>
  <aside class="learning-comment-panel ui-surface">
    <header><h2>コードのコメント</h2><div class="comment-panel-header-actions"><span>{{ comments.length }}件</span><button type="button" aria-label="コメントパネルを閉じる" @click="$emit('close')">×</button></div></header>
    <div class="comment-tabs" role="group" aria-label="コメントの表示"><button :aria-pressed="tab==='line'" @click="tab='line'">選択した行 <span>{{ selectedComments.length }}</span></button><button :aria-pressed="tab==='all'" @click="tab='all'">すべて <span>{{ comments.length }}</span></button></div>
    <section v-if="selected" class="comment-context"><div><strong>{{ rangeLabel(selected) }}</strong><span>前後のコード</span></div><pre><span v-for="line in context" :key="line.number" :class="{current:line.number>=selected.line_number&&line.number<=(selected.end_line||selected.line_number)}"><i>{{ line.number }}</i>{{ line.text || ' ' }}</span></pre><small v-if="!anchorExists(selected)" class="comment-orphan">元のコードが変更されました。保存された引用です。</small></section>
    <p v-else class="comment-help">左のコードで行番号をクリック・ドラッグして範囲を選び、＋ コメントを押してください。</p>
    <section v-if="selected && composing" class="comment-compose"><form @submit.prevent="submit"><label for="line-comment-body">{{ editing?'説明を編集':'説明・質問を書く' }}</label><textarea ref="textarea" id="line-comment-body" v-model="body" required maxlength="10000" rows="7" @input="resize" placeholder="このコードをどう解釈したか、疑問や解決した内容を書いてください。"></textarea><div class="comment-compose-footer"><small>{{ body.length.toLocaleString() }} / 10,000</small><div class="learning-actions"><button type="button" @click="cancelEdit">キャンセル</button><button class="primary" :disabled="state.busy">{{ state.busy?'保存中…':editing?'更新する':'保存する' }}</button></div></div></form></section>
    <button v-else-if="selected" class="comment-add-button" @click="startCompose">＋ 説明を追加</button>
    <p v-if="error" class="learning-error" role="alert">{{ error }}</p>
    <p v-if="!visibleComments.length && (selected || tab==='all')" class="comment-help">{{ tab==='line'?'選択した範囲にはまだ説明がありません。':'まだコメントはありません。' }}</p>
    <article v-for="c in visibleComments" :key="c.comment_id" class="line-comment" :class="{'active':matches(c)}"><button v-if="tab==='all'" class="comment-anchor" @click="choose(c)">{{ rangeLabel(c) }} · {{ c.line_text || '（空行）' }}</button><small v-if="!anchorExists(c)" class="comment-orphan">元のコードが変更されました。引用は保存されています。</small><p>{{ c.body }}</p><footer><time>{{ new Date(c.created_at).toLocaleString('ja-JP') }}</time><span><button class="quiet" @click="edit(c)">編集</button><button class="quiet danger" :disabled="state.busy" @click="deleteComment(c)">削除</button></span></footer></article>
  </aside>
</template>
<script setup>
import {computed,ref,watch,nextTick} from 'vue'
import {useLearning,learningError} from '../../composables/useLearning'
const props=defineProps({recordId:{type:String,required:true},selected:Object,anchors:{type:Array,default:()=>[]}})
const emit=defineEmits(['select','close'])
const {state,save,remove}=useLearning(),body=ref(''),editing=ref(null),error=ref('')
const tab=ref('line'),composing=ref(false),textarea=ref(null),drafts=new Map()
const key=s=>s?JSON.stringify([s.block_start,s.block_source,s.line_number,s.end_line||s.line_number]):''
const comments=computed(()=>state.comments.filter(c=>c.record_id===props.recordId))
const matches=c=>props.selected?.block_start===c.block_start&&props.selected?.block_source===c.block_source&&props.selected?.line_number<=(c.end_line||c.line_number)&&(props.selected?.end_line||props.selected?.line_number)>=c.line_number
const selectedComments=computed(()=>comments.value.filter(matches))
const visibleComments=computed(()=>tab.value==='all'?comments.value:selectedComments.value)
const context=computed(()=>props.selected?props.selected.block_source.replace(/\n$/,'').split('\n').map((text,i)=>({text,number:i+1})).filter(l=>l.number>=props.selected.line_number-2&&l.number<=(props.selected.end_line||props.selected.line_number)+2):[])
const rangeLabel=c=>c.line_number===(c.end_line||c.line_number)?c.line_number+'行目':c.line_number+'–'+c.end_line+'行'
const anchorExists=c=>{const lines=props.anchors.filter(a=>a.block_start===c.block_start&&a.block_source===c.block_source&&a.line_number>=c.line_number&&a.line_number<=(c.end_line||c.line_number));return lines.length===(c.end_line||c.line_number)-c.line_number+1&&lines.map(a=>a.line_text).join('\n')===c.line_text}
watch(()=>props.selected,(value,old)=>{if(key(value)===key(old))return;if(editing.value&&key(value)===key(editing.value)){tab.value='line';return}if(old&&body.value)drafts.set(key(old),{body:body.value,editing:editing.value});const draft=drafts.get(key(value));editing.value=draft?.editing||null;body.value=draft?.body||'';composing.value=!!body.value;tab.value='line';error.value='';nextTick(resize)})
watch(()=>props.recordId,()=>{editing.value=null;body.value='';error.value='';composing.value=false;drafts.clear()})
function resize(){if(textarea.value){textarea.value.style.height='auto';textarea.value.style.height=Math.max(190,textarea.value.scrollHeight)+'px'}}
async function startCompose(){composing.value=true;await nextTick();resize();textarea.value?.focus()}
function choose(c){tab.value='line';emit('select',c)}
function edit(c){editing.value=c;body.value=c.body;composing.value=true;choose(c);nextTick(()=>{resize();textarea.value?.focus()})}
function cancelEdit(){editing.value=null;body.value='';composing.value=false;drafts.delete(key(props.selected))}
async function submit(){error.value='';try{if(!body.value.trim())throw new Error('コメントを入力してください。');await save('comments',editing.value?.comment_id,editing.value?{body:body.value}:{record_id:props.recordId,...props.selected,body:body.value});cancelEdit()}catch(e){error.value=learningError(e)}}
async function deleteComment(c){if(window.confirm('このコメントを削除しますか？'))try{await remove('comments',c.comment_id);if(editing.value?.comment_id===c.comment_id)cancelEdit()}catch(e){error.value=learningError(e)}}
</script>
