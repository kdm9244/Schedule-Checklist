<template>
  <div class="pdf-connections-form">
    <label
      >学習目標<select
        :value="modelValue.roadmap_id || ''"
        :disabled="disabled"
        @change="set({ roadmap_id: $event.target.value, milestone_id: '', task_id: '' })"
      >
        <option value="">選択してください</option>
        <option v-for="r in state.roadmaps" :key="r.roadmap_id" :value="r.roadmap_id">
          {{ r.title }}
        </option>
      </select></label
    ><label
      >小さな目標<select
        :value="modelValue.milestone_id || ''"
        :disabled="disabled || !modelValue.roadmap_id"
        :required="required"
        @change="set({ milestone_id: $event.target.value, task_id: '' })"
      >
        <option value="">選択してください</option>
        <option
          v-for="m in state.milestones.filter((m) => m.roadmap_id === modelValue.roadmap_id)"
          :key="m.milestone_id"
          :value="m.milestone_id"
        >
          {{ m.title }}
        </option>
      </select></label
    ><label
      >やること（任意）<select
        :value="modelValue.task_id || ''"
        :disabled="disabled || !modelValue.milestone_id"
        @change="set({ task_id: $event.target.value })"
      >
        <option value="">未指定</option>
        <option
          v-for="t in state.tasks.filter((t) => t.milestone_id === modelValue.milestone_id)"
          :key="t.task_id"
          :value="t.task_id"
        >
          {{ t.title }}
        </option>
      </select></label
    >
  </div>
</template>
<script setup>
import { useLearning } from '../../composables/useLearning'
const props = defineProps({
    modelValue: { type: Object, required: true },
    disabled: Boolean,
    required: Boolean,
  }),
  emit = defineEmits(['update:modelValue'])
const { state } = useLearning()
function set(change) {
  emit('update:modelValue', { ...props.modelValue, ...change })
}
</script>
<style scoped>
.pdf-connections-form {
  display: grid;
  gap: 14px;
}
.pdf-connections-form label {
  display: grid;
  gap: 7px;
  font-size: 12px;
  color: #708199;
}
.pdf-connections-form select {
  width: 100%;
  min-width: 0;
  border: 1px solid #d7e0ed;
  border-radius: 9px;
  padding: 10px 12px;
  background: white;
  font: inherit;
  font-size: 14px;
  color: #304560;
}
</style>
