<template>
 <Teleport to="body"><dialog ref="dialog" class="delete-confirm-modal" aria-labelledby="delete-confirm-title" aria-describedby="delete-confirm-description" @cancel.prevent="close"><section><span class="delete-confirm-icon" aria-hidden="true">!</span><h3 id="delete-confirm-title">{{ title }}</h3><p id="delete-confirm-description">{{ description }}</p><p class="delete-confirm-warning">この操作は取り消せません。削除する内容を確認してください。</p><p v-if="error" class="delete-confirm-error" role="alert">{{ error }}</p><footer><button ref="cancel" type="button" :disabled="busy" @click="close">キャンセル</button><button type="button" class="danger" :disabled="busy" @click="$emit('confirm')">{{ busy?'削除中…':'削除する' }}</button></footer></section></dialog></Teleport>
</template>
<script setup>
import {onMounted,onBeforeUnmount,ref} from 'vue'
const props=defineProps({title:{type:String,required:true},description:{type:String,required:true},busy:Boolean,error:String})
const emit=defineEmits(['close','confirm']),dialog=ref(null),cancel=ref(null)
let previous
onMounted(()=>{previous=document.activeElement;dialog.value?.showModal();cancel.value?.focus()})
onBeforeUnmount(()=>{dialog.value?.close();previous?.focus?.()})
function close(){if(!props.busy)emit('close')}
</script>
<style scoped>
.delete-confirm-modal{border:0;padding:0;width:min(460px,calc(100vw - 48px));border-radius:16px;background:#fff;color:#243247;box-shadow:0 24px 70px rgba(10,20,35,.28)}
.delete-confirm-modal::backdrop{background:rgba(18,28,43,.55)}.delete-confirm-modal section{padding:28px}.delete-confirm-icon{display:grid;place-items:center;width:40px;height:40px;border-radius:50%;background:#fff0ed;color:#b33b32;font-size:22px;font-weight:700}.delete-confirm-modal h3{font-size:20px;margin:18px 0 12px}.delete-confirm-modal p{white-space:pre-wrap;overflow-wrap:anywhere;font-size:14px;line-height:1.8}.delete-confirm-warning{color:#9b4638;background:#fff4f1;padding:12px;border-radius:8px}.delete-confirm-error{color:#b33b32}.delete-confirm-modal footer{display:flex;justify-content:flex-end;gap:10px;margin-top:24px}.delete-confirm-modal button{font:inherit;padding:10px 18px;border:1px solid #d3dae5;border-radius:8px;background:#fff;color:#526176;cursor:pointer}.delete-confirm-modal .danger{background:#b33b32;color:#fff;border-color:#b33b32}.delete-confirm-modal button:disabled{opacity:.5;cursor:default}.delete-confirm-modal button:focus-visible{outline:2px solid #315cbb;outline-offset:3px}
</style>
