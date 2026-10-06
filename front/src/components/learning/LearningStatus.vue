<template>
  <div class="learning-status">
    <p v-if="state.loading" role="status" class="learning-notice">読み込み中...</p>
    <div v-if="state.schemaMissing" role="status" class="learning-notice learning-setup-notice">
      <strong>学習機能の準備が必要です</strong>
      <p>{{ state.error }}</p>
      <div><button :disabled="state.loading || state.busy" @click="load(true).catch(()=>{})">設定後に再読み込み</button></div>
    </div>
    <p v-else-if="state.error" role="alert" class="learning-error">{{ state.error }} <button :disabled="state.loading || state.busy" @click="load(true).catch(()=>{})">再読み込み</button></p>
  </div>
</template>
<script setup>
import { useLearning } from '../../composables/useLearning'
const {state,load}=useLearning()
</script>
<style scoped>
.learning-setup-notice { padding:18px; border:1px solid #d8e5f7; }
.learning-setup-notice strong { display:block; font-size:13px; }
.learning-setup-notice p { margin:7px 0 12px; }
.learning-setup-notice > div { display:flex; align-items:center; gap:16px; }
.learning-setup-notice button { padding:7px 12px; border:1px solid #cbd8ec; border-radius:7px; background:white; color:#526e99; cursor:pointer; font:inherit; }
.learning-setup-notice a { color:#315cbb; text-decoration:none; }
</style>
