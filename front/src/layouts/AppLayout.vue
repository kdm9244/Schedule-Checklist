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
  height: 100vh;
  overflow: hidden;
}

.main-content {
  flex: 1;
  min-width: 0;
  height: 100vh;
  overflow: auto;
  background: #eef1f5;
  padding: 24px;
  box-sizing: border-box;
}
</style>
