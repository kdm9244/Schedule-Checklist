<template>
  <Teleport to="body"
    ><dialog
      ref="dialog"
      class="word-sources-modal"
      aria-labelledby="word-sources-title"
      @cancel.prevent="close"
    >
      <form @submit.prevent="$emit('confirm', { ids: selected, ...draft })">
        <h2 id="word-sources-title">{{ mode === 'edit' ? '単語を編集' : '出典を選んで削除' }}</h2>
        <div v-if="mode === 'edit'" class="source-edit-fields">
          <label
            >単語<input v-model="draft.word" required maxlength="200" :disabled="busy"
          /></label>
          <label>読み方<input v-model="draft.reading" maxlength="200" :disabled="busy" /></label>
          <label
            >意味<input v-model="draft.meaning" required maxlength="1000" :disabled="busy"
          /></label>
        </div>
        <p>選択した出典だけに{{ mode === 'edit' ? '変更を適用' : '削除を適用' }}します。</p>
        <label class="source-check"
          ><input
            type="checkbox"
            :checked="selected.length === sources.length"
            :disabled="busy"
            @change="selected = $event.target.checked ? sources.map((s) => s.word_id) : []"
          />すべての出典を選択</label
        >
        <div class="source-options">
          <label v-for="source in sources" :key="source.word_id" class="source-check">
            <input
              v-model="selected"
              type="checkbox"
              :value="source.word_id"
              :disabled="busy"
            /><span
              ><strong>{{ source.word }}</strong> · {{ source.pdf_title }} · p.{{ source.page
              }}<small
                >{{ source.roadmap_title || '目標未設定' }} /
                {{ source.milestone_title || '未設定' }}</small
              ></span
            >
          </label>
        </div>
        <p v-if="mode === 'delete'" class="source-danger">
          削除した出典の単語は元のPDFノートからも削除されます。この操作は取り消せません。
        </p>
        <p v-if="error" class="source-danger" role="alert">{{ error }}</p>
        <footer>
          <button v-if="mode === 'edit'" type="button" :disabled="busy" @click="$emit('delete')">
            削除…
          </button>
          <button v-else type="button" :disabled="busy" @click="$emit('back')">編集に戻る</button>
          <span>{{ selected.length }}件選択</span
          ><button type="button" :disabled="busy" @click="close">キャンセル</button
          ><button
            :class="mode === 'delete' ? 'danger' : 'primary'"
            :disabled="busy || !selected.length"
          >
            {{ busy ? '処理中…' : mode === 'edit' ? '保存' : '選択した出典を削除' }}
          </button>
        </footer>
      </form>
    </dialog></Teleport
  >
</template>
<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue'
const props = defineProps({
  mode: String,
  sources: Array,
  word: Object,
  busy: Boolean,
  error: String,
})
const emit = defineEmits(['close', 'confirm', 'delete', 'back'])
const dialog = ref(null),
  selected = ref([]),
  draft = ref({
    word: props.word?.word || '',
    reading: props.word?.reading || '',
    meaning: props.word?.meaning || '',
  })
let previous
onMounted(() => {
  previous = document.activeElement
  dialog.value.showModal()
  dialog.value.querySelector('input')?.focus()
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
.word-sources-modal {
  border: 0;
  border-radius: 14px;
  padding: 24px;
  width: min(620px, calc(100vw - 32px));
  max-height: 90dvh;
  overflow: auto;
  box-sizing: border-box;
  color: #26364c;
  box-shadow: 0 20px 60px #14213840;
}
.word-sources-modal::backdrop {
  background: #14213880;
}
h2 {
  font-size: 20px;
  margin: 0 0 18px;
}
p {
  font-size: 13px;
  color: #708199;
}
.source-edit-fields {
  display: grid;
  gap: 10px;
}
.source-edit-fields label {
  display: grid;
  gap: 5px;
  font-size: 12px;
}
.source-edit-fields input {
  padding: 9px;
  border: 1px solid #cdd8e8;
  border-radius: 7px;
  font: inherit;
}
.source-check {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  font-size: 13px;
  padding: 10px 0;
}
.source-check input {
  accent-color: #315cbb;
  flex-shrink: 0;
  margin-top: 3px;
}
.source-check span {
  overflow-wrap: anywhere;
}
.source-check small {
  display: block;
  color: #708199;
  margin-top: 4px;
}
.source-options {
  max-height: 260px;
  overflow: auto;
  border-top: 1px solid #e3e9f1;
  border-bottom: 1px solid #e3e9f1;
}
.source-danger {
  color: #b42335;
}
footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 20px;
  flex-wrap: wrap;
}
footer span {
  margin-right: auto;
  font-size: 12px;
  color: #708199;
}
button {
  font: inherit;
  font-size: 13px;
  border: 1px solid #d9e1ed;
  background: white;
  border-radius: 8px;
  padding: 8px 12px;
  cursor: pointer;
}
.primary {
  background: #315cbb;
  color: white;
  border-color: #315cbb;
}
.danger {
  background: #b42335;
  color: white;
  border-color: #b42335;
}
button:disabled {
  opacity: 0.5;
  cursor: default;
}
</style>
