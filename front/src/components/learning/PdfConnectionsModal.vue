<template>
  <Teleport to="body">
    <dialog
      ref="dialog"
      class="connections-modal"
      aria-labelledby="connections-title"
      @cancel.prevent="close"
    >
      <form @submit.prevent="$emit('save', { ...value })">
        <h2 id="connections-title">保存する学習目標</h2>
        <PdfConnectionsForm v-model="value" required :disabled="busy" />
        <p v-if="error" role="alert">{{ error }}</p>
        <footer>
          <button type="button" :disabled="busy" @click="close">キャンセル</button
          ><button class="primary" :disabled="busy || !value.milestone_id">
            {{ busy ? '保存中…' : '保存' }}
          </button>
        </footer>
      </form>
    </dialog>
  </Teleport>
</template>
<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue'
import PdfConnectionsForm from './PdfConnectionsForm.vue'
const props = defineProps({
  connections: { type: Object, required: true },
  busy: Boolean,
  error: String,
})
const emit = defineEmits(['close', 'save'])
const value = ref({
  roadmap_id: props.connections.roadmap_id || '',
  milestone_id: props.connections.milestone_id || '',
  task_id: props.connections.task_id || '',
})
const dialog = ref(null)
let previous
onMounted(() => {
  previous = document.activeElement
  dialog.value.showModal()
  dialog.value.querySelector('select')?.focus()
})
onBeforeUnmount(() => {
  dialog.value?.close()
  previous?.focus?.()
})
function close() {
  if (!props.busy) emit('close')
}
</script>
<style scoped>
.connections-modal {
  border: 0;
  border-radius: 14px;
  padding: 26px;
  width: min(460px, calc(100vw - 40px));
  box-sizing: border-box;
  max-height: 90dvh;
  overflow: auto;
  color: #26364c;
  background: white;
  box-shadow: 0 20px 60px #14213840;
}
.connections-modal::backdrop {
  background: #14213880;
}
h2 {
  font-size: 19px;
  margin: 0 0 24px;
}
footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 24px;
}
button {
  font: inherit;
  padding: 9px 18px;
  background: white;
  border: 1px solid #d7e0ed;
  border-radius: 8px;
  cursor: pointer;
}
.primary {
  color: white;
  background: #315cbb;
  border-color: #315cbb;
}
button:disabled {
  opacity: 0.5;
  cursor: default;
}
p {
  color: #b42335;
  font-size: 13px;
}
</style>
