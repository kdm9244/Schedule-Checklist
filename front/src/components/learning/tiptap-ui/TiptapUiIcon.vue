<template><span class="tiptap-ui-icon" aria-hidden="true" v-html="icons[name]"></span></template>
<script setup>
// Static MIT-licensed SVGs from ueberdosis/tiptap-ui-components.
// This component never renders user-provided markup.
import bold from './bold.svg?raw'
import highlighter from './highlighter.svg?raw'
import chevron from './chevron-down.svg?raw'
import undo from './undo2.svg?raw'
import redo from './redo2.svg?raw'
defineProps({name:{type:String,required:true}})
const icons={bold,highlighter,chevron,undo,redo}
</script>
<style scoped>.tiptap-ui-icon{display:inline-flex;width:18px;height:18px;flex-shrink:0}.tiptap-ui-icon :deep(svg){display:block;width:100%;height:100%}</style>
