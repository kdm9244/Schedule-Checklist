<template>
  <div
    class="pdf-dropzone"
    :class="{ dragging }"
    @dragover.prevent="dragging = true"
    @dragleave.prevent="dragging = false"
    @drop.prevent="drop"
  >
    <span class="drop-icon">PDF</span>
    <h2>{{ busy ? 'PDFを保存中…' : 'PDFをここにドラッグ' }}</h2>
    <p>
      {{
        disabled
          ? '上の「保存先を選択」から小さな目標を選んでください。'
          : 'ファイルを保存すると、ここでPDFが開きます。'
      }}
    </p>
    <button type="button" :disabled="busy || disabled" @click="input.click()">ファイルを選ぶ</button
    ><small>PDF · 最大30MB</small
    ><input
      ref="input"
      class="sr-only"
      type="file"
      accept=".pdf,application/pdf"
      aria-label="PDFファイルを選択"
      :disabled="busy || disabled"
      @change="select($event.target.files[0])"
    />
  </div>
</template>
<script setup>
import { ref } from 'vue'
const props = defineProps({ busy: Boolean, disabled: Boolean }),
  emit = defineEmits(['file']),
  input = ref(null),
  dragging = ref(false)
function select(file) {
  if (file && !props.busy && !props.disabled) emit('file', file)
}
function drop(event) {
  dragging.value = false
  select(event.dataTransfer.files[0])
}
</script>
<style scoped>
.pdf-dropzone {
  height: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  border: 2px dashed #c6d3e7;
  border-radius: 12px;
  background: #f5f8fc;
  text-align: center;
  padding: 30px;
  color: #5b7291;
}
.pdf-dropzone.dragging {
  background: #edf3ff;
  border-color: #547fc7;
}
.drop-icon {
  display: grid;
  place-items: center;
  width: 58px;
  height: 70px;
  border: 1px solid #cfdaf0;
  border-radius: 12px;
  background: #fff;
  color: #6082bd;
  font-size: 12px;
  font-weight: 700;
}
.pdf-dropzone h2 {
  font-size: 19px;
  margin: 8px 0 0;
}
.pdf-dropzone p {
  font-size: 13px;
  line-height: 1.7;
  margin: 0;
  max-width: 300px;
}
.pdf-dropzone button {
  border: 1px solid #b9ccea;
  background: #fff;
  border-radius: 9px;
  padding: 10px 18px;
  color: #315cbb;
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
.pdf-dropzone button:disabled {
  opacity: 0.5;
  cursor: default;
}
.pdf-dropzone small {
  font-size: 11px;
  color: #96a3b6;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
}
</style>
