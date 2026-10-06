<template>
  <aside class="learning-comment-panel ui-surface">
    <header><h2>コードのコメント</h2><span>{{ comments.length }}件</span></header>
    <p class="comment-help">コードの行番号・＋を押すと、その行に説明や疑問を残せます。</p>
    <section v-if="selected" class="comment-compose"><strong>{{ selected.line_number }}行目</strong><pre>{{ selected.line_text || '（空行）' }}</pre><form @submit.prevent="submit"><label for="line-comment-body">説明・質問</label><textarea id="line-comment-body" v-model="body" required maxlength="10000" rows="5" placeholder="この部分はこう解釈した、など自由に書いてください。"></textarea><div class="learning-actions"><button v-if="editing" type="button" @click="cancelEdit">キャンセル</button><button class="primary" :disabled="state.busy">{{ editing?'更新する':'コメントを追加' }}</button></div></form></section>
    <p v-if="error" class="learning-error" role="alert">{{ error }}</p>
    <p v-if="!comments.length" class="comment-help">まだコメントはありません。</p>
    <article v-for="c in comments" :key="c.comment_id" class="line-comment" :class="{'active':matches(c)}"><button class="comment-anchor" @click="$emit('select',c)">{{ c.line_number }}行目 · {{ c.line_text || '（空行）' }}</button><small v-if="!anchorExists(c)" class="comment-orphan">元のコードが変更されました。引用は保存されています。</small><p>{{ c.body }}</p><footer><time>{{ new Date(c.created_at).toLocaleString('ja-JP') }}</time><span><button class="quiet" @click="edit(c)">編集</button><button class="quiet danger" :disabled="state.busy" @click="deleteComment(c)">削除</button></span></footer></article>
  </aside>
</template>
<script setup>
import {computed,ref,watch} from 'vue'
import {useLearning,learningError} from '../../composables/useLearning'
const props=defineProps({recordId:{type:String,required:true},selected:Object,anchors:{type:Array,default:()=>[]}})
const emit=defineEmits(['select'])
const {state,save,remove}=useLearning(),body=ref(''),editing=ref(null),error=ref('')
const comments=computed(()=>state.comments.filter(c=>c.record_id===props.recordId))
const matches=c=>props.selected?.block_start===c.block_start&&props.selected?.block_source===c.block_source&&props.selected?.line_number===c.line_number
const anchorExists=c=>props.anchors.some(a=>a.block_start===c.block_start&&a.block_source===c.block_source&&a.line_number===c.line_number&&a.line_text===c.line_text)
watch(()=>props.selected,()=>{if(editing.value&&!matches(editing.value)){editing.value=null;body.value=''};error.value=''})
watch(()=>props.recordId,()=>{editing.value=null;body.value='';error.value=''})
function edit(c){editing.value=c;body.value=c.body;emit('select',c)}
function cancelEdit(){editing.value=null;body.value=''}
async function submit(){error.value='';try{if(!body.value.trim())throw new Error('コメントを入力してください。');await save('comments',editing.value?.comment_id,editing.value?{body:body.value}:{record_id:props.recordId,...props.selected,body:body.value});cancelEdit()}catch(e){error.value=learningError(e)}}
async function deleteComment(c){if(window.confirm('このコメントを削除しますか？'))try{await remove('comments',c.comment_id);if(editing.value?.comment_id===c.comment_id)cancelEdit()}catch(e){error.value=learningError(e)}}
</script>
