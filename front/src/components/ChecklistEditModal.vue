<template>
  <Teleport to="body">
    <div class="checklist-modal-backdrop" @click.self="close" @keydown.esc="close">
      <section class="checklist-modal" role="dialog" aria-modal="true" aria-labelledby="checklist-modal-title">
        <h3 id="checklist-modal-title">チェックリストを編集</h3>
        <input ref="titleInput" v-model="draft" maxlength="200" :disabled="busy"
          @keydown.enter.prevent="save">
        <p v-if="error" class="modal-error" role="alert">{{ error }}</p>
        <div class="modal-actions">
          <button type="button" class="delete" :disabled="busy" @click="remove">削除</button>
          <span></span>
          <button type="button" :disabled="busy" @click="close">キャンセル</button>
          <button type="button" class="save" :disabled="busy || !draft.trim() || draft.trim()===title" @click="save">
            {{ busy ? '保存中...' : '保存' }}
          </button>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<script setup>
import { nextTick, onMounted, ref } from 'vue'

const props=defineProps({title:{type:String,required:true},busy:Boolean,error:{type:String,default:''}})
const emit=defineEmits(['close','save','delete'])
const draft=ref(props.title),titleInput=ref(null)
onMounted(()=>nextTick(()=>{titleInput.value?.focus();titleInput.value?.select()}))
function close(){if(!props.busy)emit('close')}
function save(){const title=draft.value.trim();if(!props.busy&&title&&title!==props.title)emit('save',title)}
function remove(){if(!props.busy)emit('delete')}
</script>

<style scoped>
.checklist-modal-backdrop{position:fixed;inset:0;z-index:1100;display:grid;place-items:center;padding:20px;background:rgba(18,28,43,.55)}
.checklist-modal{width:min(440px,100%);padding:26px;border-radius:16px;background:#fff;box-shadow:0 24px 70px rgba(10,20,35,.28);color:#243247}
.checklist-modal h3{margin:0 0 18px;font-size:18px}.checklist-modal input{width:100%;height:44px;padding:0 12px;border:1px solid #cbd5e1;border-radius:9px;color:#243247;outline:none}.checklist-modal input:focus{border-color:#315cbb;box-shadow:0 0 0 3px rgba(49,92,187,.1)}
.modal-error{margin:10px 0 0;color:#b33b32;font-size:11px}.modal-actions{display:grid;grid-template-columns:auto 1fr auto auto;gap:8px;margin-top:20px}.modal-actions button{padding:9px 13px;border:1px solid #d3dae5;border-radius:8px;background:#fff;color:#526176;cursor:pointer}.modal-actions button:disabled{opacity:.5;cursor:default}.modal-actions .delete{border-color:#edc7c3;color:#b33b32}.modal-actions .save{border-color:#315cbb;background:#315cbb;color:#fff}
@media(max-width:520px){.checklist-modal{padding:22px 18px}.modal-actions{grid-template-columns:1fr 1fr}.modal-actions span{display:none}.modal-actions .delete{grid-column:1/-1}}
</style>
