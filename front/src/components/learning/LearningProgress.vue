<template><div class="learning-progress"><div class="learning-progress-copy"><span>{{ value.completed }} / {{ value.total }} タスク完了</span><strong>{{ value.percent }}%</strong></div><div class="learning-progress-track" role="progressbar" :aria-valuenow="value.percent" aria-valuemin="0" aria-valuemax="100" aria-label="学習の進捗"><span :style="{width:value.percent+'%'}"></span></div></div></template>
<script setup>
defineProps({value:{type:Object,required:true}})
</script>
