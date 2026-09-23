<template>
  <div class="app-layout">
    <AppSidebar />

    <main class="main-content">
      <RouterView />
    </main>
  </div>
</template>

<script setup>
import AppSidebar from '@/components/AppSidebar.vue'
import { RouterView } from 'vue-router'
</script>

<style scoped>
.app-layout {
  display: flex;
  width: 100%;
  height: 100dvh;
  overflow: hidden;
}

.main-content {
  flex: 1;
  min-width: 0;
  height: 100dvh;
  overflow: auto;
  background: var(--ui-bg);
  padding: clamp(16px, 2vw, 24px);
  box-sizing: border-box;
}

@media (max-width: 700px) {
  .app-layout { display: block; overflow: hidden; }
  .main-content { width: 100%; padding: 14px 12px 80px; }
}
</style>
