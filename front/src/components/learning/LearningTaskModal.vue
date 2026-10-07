<template>
 <Teleport to="body"><dialog ref="dialog" class="task-form-dialog" @cancel.prevent="close"><form @submit.prevent="submit"><h2>{{ move?'やることを移動':task?'やることを編集':'やることを追加' }}</h2><label v-if="move">移動先の小さな目標<select v-model="destination" required><option value="">選択してください</option><option v-for="m in destinations" :key="m.milestone_id" :value="m.milestone_id">{{ m.title }}</option></select></label><template v-else><label>名前<input v-model="form.title" required maxlength="200" /></label><div class="task-form-dates"><label>開始日<input v-model="form.start_date" type="date" required :max="form.target_date||undefined" /></label><label>目標日<input v-model="form.target_date" type="date" required :min="form.start_date||undefined" /></label></div></template><p v-if="move" class="task-modal-help">学習ノート・コメント・学習予定は保持され、移動先にも引き継がれます。完了状態と日付は変わりません。</p><p v-if="move&&!destinations.length" class="learning-error">同じ学習目標に移動先の小さな目標がありません。</p><p v-if="error" class="learning-error" role="alert">{{ error }}</p><footer><button type="button" :disabled="state.busy" @click="close">キャンセル</button><button class="primary" :disabled="state.busy||(move&&!destinations.length)">{{ state.busy?'保存中…':move?'移動する':'保存する' }}</button></footer></form></dialog></Teleport>
</template>
<script setup>
import {computed,onMounted,onBeforeUnmount,reactive,ref} from 'vue'
import {useLearning,learningError} from '../../composables/useLearning'
import {dateKey,validDate} from '../../utils/calendar'
const props=defineProps({milestoneId:{type:String,required:true},task:Object,move:Boolean}),emit=defineEmits(['close','saved'])
const {state,save,moveTask}=useLearning(),dialog=ref(null),error=ref(''),destination=ref(''),form=reactive({title:props.task?.title||'',start_date:props.task?.start_date||dateKey(new Date()),target_date:props.task?.target_date||''})
const parent=computed(()=>state.milestones.find(m=>m.milestone_id===props.milestoneId))
const destinations=computed(()=>state.milestones.filter(m=>m.roadmap_id===parent.value?.roadmap_id&&m.milestone_id!==props.milestoneId))
let previous
onMounted(()=>{previous=document.activeElement;dialog.value.showModal();dialog.value.querySelector('input,select')?.focus()})
onBeforeUnmount(()=>{dialog.value?.close();previous?.focus?.()})
function close(){if(!state.busy)emit('close')}
async function submit(){error.value='';try{if(props.move){await moveTask(props.task.task_id,destination.value)}else{if(!form.title.trim()||!validDate(form.start_date)||!validDate(form.target_date)||form.start_date>form.target_date)throw new Error('名前・開始日・目標日を確認してください。');await save('tasks',props.task?.task_id,{...form,milestone_id:props.milestoneId})}emit('saved')}catch(e){error.value=learningError(e)}}
</script>
<style scoped>
.task-form-dialog{border:0;border-radius:16px;width:min(500px,calc(100vw - 48px));padding:28px;color:#243b57;box-shadow:0 20px 60px #13294040}.task-form-dialog::backdrop{background:#12203088}.task-form-dialog h2{font-size:21px;margin:0 0 24px}.task-form-dialog label{display:flex;flex-direction:column;gap:8px;font-size:14px;margin-bottom:18px}.task-form-dialog input,.task-form-dialog select{font:inherit;padding:12px;border:1px solid #cbd7e6;border-radius:8px;min-width:0}.task-form-dates{display:grid;grid-template-columns:1fr 1fr;gap:16px}.task-form-dialog footer{display:flex;justify-content:flex-end;gap:10px;margin-top:20px}.task-form-dialog button{font:inherit;padding:10px 18px;border:1px solid #d3dae5;border-radius:8px;background:white;cursor:pointer}.task-form-dialog .primary{background:#315cbb;color:white;border-color:#315cbb}.task-modal-help{font-size:13px;line-height:1.8;color:#637996}.task-form-dialog button:disabled{opacity:.5}
</style>
