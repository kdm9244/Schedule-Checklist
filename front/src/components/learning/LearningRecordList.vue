<template>
  <div class="learning-record-list">
    <p v-if="!records.length" class="learning-empty-small">学習記録はまだありません。学んだことを残しましょう。</p>
    <RouterLink v-for="record in sorted" :key="record.record_id" :to="'/learning/records/'+record.record_id" class="learning-record-link">
      <span class="learning-record-icon">▤</span><div><small>{{ record.study_date }} · {{ record.milestone_id ? 'マイルストーンの記録' : '未指定の記録' }}</small><strong>{{ record.title }}</strong></div><span>›</span>
    </RouterLink>
  </div>
</template>
<script setup>
import { computed } from 'vue'
const props=defineProps({records:{type:Array,default:()=>[]},oldest:Boolean})
const sorted=computed(()=>[...props.records].sort((a,b)=>(b.study_date.localeCompare(a.study_date)||(BigInt(b.record_id)>BigInt(a.record_id)?1:BigInt(b.record_id)<BigInt(a.record_id)?-1:0))*(props.oldest?-1:1)))
</script>
