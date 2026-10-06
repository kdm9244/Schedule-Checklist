<template>
  <form class="learning-form" @submit.prevent="submit">
    <label v-if="kind==='milestones'">ロードマップ <span class="required">必須</span><select v-model="draft.roadmap_id" required :disabled="!!entity"><option value="">選択してください</option><option v-for="r in state.roadmaps" :key="r.roadmap_id" :value="r.roadmap_id">{{ r.title }}</option></select></label>
    <p v-if="kind==='milestones'&&!state.roadmaps.length" class="learning-notice">先に<RouterLink to="/learning/roadmaps/new">ロードマップを作成</RouterLink>してください。</p>
    <label>タイトル <span class="required">必須</span><input v-model="draft.title" required maxlength="200" placeholder="例：Vue 3 の基礎を理解する" /></label>
    <label>{{ kind==='milestones' ? '説明・完了基準' : '説明' }}<textarea v-model="draft.description" maxlength="10000" rows="5" placeholder="どこまでできるようになりたいですか？"></textarea></label>
    <label>開始日 <span class="required">必須</span><input v-model="draft.start_date" type="date" required :min="parent?.start_date" :max="date || parent?.target_date" /></label><label>締切日 <span class="required">必須</span><input v-model="date" type="date" required :min="draft.start_date || parent?.start_date" :max="parent?.target_date" /></label><p v-if="parent" class="learning-notice">ロードマップの期間：{{ parent.start_date || '未設定' }} 〜 {{ parent.target_date || '未設定' }}。この期間内で選択してください。</p>
    <p v-if="error" class="learning-error" role="alert">{{ error }}</p>
    <div class="learning-actions"><button type="button" @click="$emit('cancel')">キャンセル</button><button class="primary" :disabled="state.busy || !state.loaded || (kind==='milestones'&&!state.roadmaps.length)">{{ state.busy?'保存中...':'保存する' }}</button></div>
  </form>
</template>
<script setup>
import { computed, reactive, ref } from 'vue'
import { useLearning,learningError } from '../../composables/useLearning'
const props=defineProps({kind:{type:String,required:true},entity:Object,roadmapId:String})
const emit=defineEmits(['saved','cancel'])
const {state,save}=useLearning()
const draft=reactive({roadmap_id:props.roadmapId||'',title:'',description:'',start_date:'',target_date:'',due_date:'',...props.entity})
const date=computed({get:()=>draft[props.kind==='milestones'?'due_date':'target_date'],set:v=>draft[props.kind==='milestones'?'due_date':'target_date']=v})
const parent=computed(()=>props.kind==='milestones'?state.roadmaps.find(r=>r.roadmap_id===draft.roadmap_id):null)
const error=ref('')
async function submit(){error.value='';try{if(!draft.title.trim())throw new Error('タイトルを入力してください。'); if(!draft.start_date||!date.value||draft.start_date>date.value)throw new Error('開始日と締切日を確認してください。');if(parent.value&&(!parent.value.start_date||!parent.value.target_date||draft.start_date<parent.value.start_date||date.value>parent.value.target_date))throw new Error('先にロードマップの期間を設定し、その期間内で選択してください。'); const key=props.kind==='milestones'?'milestone_id':'roadmap_id';const before=state[props.kind].map(r=>r[key]);await save(props.kind,props.entity?.[key],{...draft});const item=props.entity?state[props.kind].find(r=>r[key]===props.entity[key]):state[props.kind].find(r=>!before.includes(r[key]));emit('saved',item)}catch(e){error.value=learningError(e)}}
</script>
