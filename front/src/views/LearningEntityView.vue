<template><div class="learning-page learning learning-narrow"><RouterLink to="/learning/roadmaps" class="learning-back">‹ 学習目標一覧</RouterLink><header class="learning-header"><div><span class="learning-eyebrow">PLAN YOUR NEXT STEP</span><h1>{{ kind==='milestones'?'小さな目標':'学習目標' }}{{ route.params.id?'を編集':'作成' }}</h1><p>{{ kind==='milestones'?'達成したいことを、具体的なステップに。':'学びたいことと目標を、自分のペースで。' }}</p></div></header><LearningStatus /><section v-if="state.loaded&&(!route.params.id||entity)" class="learning-form-card ui-surface"><LearningEntityForm :key="route.fullPath" :kind="kind" :entity="entity" :roadmap-id="String(route.query.roadmap||'')" @saved="saved" @cancel="cancel" /></section><p v-else-if="state.loaded" class="learning-empty">データが見つかりません。</p></div></template>
<script setup>
import {computed,onMounted} from 'vue'
import {useRoute,useRouter} from 'vue-router'
import {useLearning} from '../composables/useLearning'
import LearningStatus from '../components/learning/LearningStatus.vue'
import LearningEntityForm from '../components/learning/LearningEntityForm.vue'
const route=useRoute(),router=useRouter(),{state,load}=useLearning()
const kind=computed(()=>route.meta.entity)
const entity=computed(()=>route.params.id?state[kind.value].find(r=>r[kind.value==='milestones'?'milestone_id':'roadmap_id']===route.params.id):undefined)
function saved(item){router.push('/learning/'+kind.value+'/'+item[kind.value==='milestones'?'milestone_id':'roadmap_id'])}
function cancel(){router.push(entity.value?'/learning/roadmaps/'+entity.value.roadmap_id:route.query.roadmap?'/learning/roadmaps/'+route.query.roadmap:'/learning/roadmaps')}
onMounted(()=>load().catch(()=>{}))
</script>
