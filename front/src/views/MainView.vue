<template>
  <div class="app-layout">
    <AppSidebar />

    <main class="main-content">
      <RouterView />
    </main>
  </div>
</template>

<script setup>
import AppSidebar from '../components/AppSidebar.vue'
import { RouterView } from 'vue-router'
</script>

<style scoped>
.app-layout {
  width: 100%;
  height: 100vh;

  display: flex;

  overflow: hidden;

  background: #eef1f5;
}

.main-content {
  flex: 1;
  width: 0;
  height: 100%;
  min-width: 0;
  min-height: 0;

  padding: 28px 34px;
  box-sizing: border-box;

  overflow: auto;

  background: #eef1f5;
}

@media (max-width: 1050px) {
  .main-content { padding: 20px; }
}

@media (max-width: 600px) {
  .main-content { width: 100%; height: calc(100% - 62px); padding: 12px; margin-bottom: 62px; }
}
</style>
