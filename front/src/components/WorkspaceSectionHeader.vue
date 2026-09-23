<template>
  <header class="workspace-section-header">
    <div class="workspace-section-copy">
      <span class="workspace-section-eyebrow">{{ eyebrow }}</span>
      <h2 :id="headingId">{{ title }}</h2>
    </div>
    <div v-if="$slots.actions" class="workspace-section-actions"><slot name="actions" /></div>
  </header>
</template>

<script setup>
defineProps({eyebrow:{type:String,required:true},title:{type:String,required:true},headingId:{type:String,default:undefined}})
</script>
