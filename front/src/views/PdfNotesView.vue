<template>
  <div class="learning-page learning note-library-page">
    <header class="library-page-header"><span>NOTE LIBRARY</span><h1>ノートライブラリ</h1><p>資料と学習の記録を、ひとつの場所で。</p></header>
    <LearningStatus />
    <section class="library-surface ui-surface"><LearningRecordBrowser :task-id="contextTask" :milestone-id="contextMilestone" :roadmap-id="contextRoadmap" initial-kind="pdf" /></section>
  </div>
</template>
<script setup>
import {computed,onMounted} from 'vue'
import {useRoute} from 'vue-router'
import {useLearning} from '../composables/useLearning'
import LearningStatus from '../components/learning/LearningStatus.vue'
import LearningRecordBrowser from '../components/learning/LearningRecordBrowser.vue'
const route=useRoute(),{load}=useLearning()
const contextTask=computed(()=>route.query.task?String(route.query.task):undefined)
const contextMilestone=computed(()=>route.query.milestone?String(route.query.milestone):undefined)
const contextRoadmap=computed(()=>route.query.roadmap?String(route.query.roadmap):undefined)
onMounted(()=>load().catch(()=>{}))
</script>
<style scoped>
.note-library-page{max-width:1200px}.library-page-header{margin-bottom:28px}.library-page-header>span{font-size:10px;letter-spacing:.15em;color:#8898af}.library-page-header h1{font-size:28px;margin:9px 0;color:#273e5b}.library-page-header p{font-size:14px;color:#8493a9;margin:0}.library-surface{padding:26px 28px;border:1px solid #dde5f0;border-radius:16px;background:#fff}@media(max-width:700px){.library-surface{padding:20px 16px}.library-page-header{margin-bottom:20px}.library-page-header h1{font-size:23px}}
</style>
