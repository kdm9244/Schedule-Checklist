<template>
  <section class="pdf-document-pane" aria-label="PDFビューア">
    <nav class="pdf-toolbar">
      <div class="page-controls">
        <button :disabled="!document || page <= 1" aria-label="前のページ" @click="page--">‹</button
        ><label
          ><span class="sr-only">PDFページ</span
          ><input
            v-model.number="page"
            type="number"
            min="1"
            :max="count || 1"
            @change="clamp" /></label
        ><span>/ {{ count || '—' }}</span
        ><button :disabled="!document || page >= count" aria-label="次のページ" @click="page++">
          ›
        </button>
      </div>
      <div class="zoom-controls">
        <button :disabled="!document" aria-label="縮小" @click="changeZoom(-25)">−</button
        ><select v-model="zoom" aria-label="PDFの表示倍率">
          <option value="fit">幅に合わせる</option>
          <option v-for="n in zoomOptions" :key="n" :value="String(n)">{{ n }}%</option></select
        ><button :disabled="!document" aria-label="拡大" @click="changeZoom(25)">＋</button>
      </div>
    </nav>
    <div ref="pdfScroll" class="pdf-scroll">
      <p v-if="loading" class="pdf-status" role="status">PDFを読み込み中…</p>
      <p v-if="pdfError" class="pdf-status" role="alert">
        {{ pdfError }} <button @click="openPdf">再試行</button>
      </p>
      <div ref="pageSurface" class="pdf-page-surface">
        <canvas ref="canvas" aria-label="現在のPDFページ" />
        <div ref="textContainer" class="pdf-text-layer" aria-label="選択できるPDFテキスト"></div>
      </div>
    </div>
    <footer>
      <span>{{ Math.round(actualScale * 100) }}% · {{ page }}ページ</span
      ><span>{{ textSelectable ? '文字を選択・コピーできます' : '画像PDF' }}</span>
    </footer>
  </section>
</template>
<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount, markRaw } from 'vue'
import { TextLayer, getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
GlobalWorkerOptions.workerSrc = workerUrl
const props = defineProps({
    src: { type: String, required: true },
    modelValue: { type: Number, default: 1 },
  }),
  emit = defineEmits(['update:modelValue', 'loaded'])
const document = ref(null),
  page = ref(props.modelValue),
  count = ref(0),
  zoom = ref('fit'),
  actualScale = ref(1),
  canvas = ref(null),
  pageSurface = ref(null),
  textContainer = ref(null),
  pdfScroll = ref(null),
  loading = ref(false),
  pdfError = ref(''),
  textSelectable = ref(false)
let textLayer,
  renderTask,
  loadingTask,
  renderVersion = 0,
  disposed = false,
  observer,
  resizeFrame,
  lastWidth = 0
const zoomOptions = computed(() =>
  [
    ...new Set([
      75,
      100,
      125,
      150,
      175,
      200,
      250,
      300,
      ...(zoom.value === 'fit' ? [] : [Number(zoom.value)]),
    ]),
  ].sort((a, b) => a - b),
)
function clamp() {
  page.value = Math.max(1, Math.min(count.value || 100000, Math.trunc(page.value) || 1))
}
function changeZoom(delta) {
  zoom.value = String(
    Math.max(50, Math.min(300, Math.round((actualScale.value * 100) / 25) * 25 + delta)),
  )
}
async function render() {
  if (!document.value || !canvas.value || !pdfScroll.value?.clientWidth) return
  const revision = ++renderVersion
  const previous = renderTask
  previous?.cancel()
  textLayer?.cancel()
  try {
    if (previous) await previous.promise.catch(() => {})
    const p = await document.value.getPage(page.value)
    if (revision !== renderVersion || disposed) return
    const scale =
      zoom.value === 'fit'
        ? Math.max(0.2, (pdfScroll.value.clientWidth - 24) / p.getViewport({ scale: 1 }).width)
        : Number(zoom.value) / 100
    const viewport = p.getViewport({ scale })
    const ratio = Math.min(window.devicePixelRatio || 1, 3)
    actualScale.value = scale
    canvas.value.width = Math.ceil(viewport.width * ratio)
    canvas.value.height = Math.ceil(viewport.height * ratio)
    canvas.value.style.width = viewport.width + 'px'
    canvas.value.style.height = viewport.height + 'px'
    pageSurface.value.style.width = viewport.width + 'px'
    pageSurface.value.style.height = viewport.height + 'px'
    textContainer.value.replaceChildren()
    textContainer.value.style.setProperty('--total-scale-factor', String(scale))
    renderTask = p.render({
      canvasContext: canvas.value.getContext('2d'),
      viewport,
      transform: ratio === 1 ? null : [ratio, 0, 0, ratio, 0, 0],
    })
    await renderTask.promise
    if (revision !== renderVersion || disposed) return
    const content = await p.getTextContent()
    if (revision !== renderVersion || disposed) return
    textSelectable.value = content.items.some((i) => i.str?.trim())
    textLayer = new TextLayer({
      textContentSource: content,
      container: textContainer.value,
      viewport,
    })
    await textLayer.render()
  } catch (e) {
    if (!['RenderingCancelledException', 'AbortException'].includes(e.name) && !disposed)
      pdfError.value = 'ページを表示できません。'
  }
}

async function openPdf() {
  loading.value = true
  pdfError.value = ''
  try {
    renderTask?.cancel()
    textLayer?.cancel()
    await loadingTask?.destroy()
    loadingTask = getDocument({ url: props.src, withCredentials: true, isEvalSupported: false })
    const doc = await loadingTask.promise
    if (disposed) {
      await doc.destroy()
      return
    }
    document.value = markRaw(doc)
    count.value = doc.numPages
    clamp()
    emit('loaded', doc.numPages)
    await nextTick()
    await render()
  } catch (error) {
    if (!disposed) pdfError.value = 'PDFを開けません。ファイル・パスワード保護を確認してください。'
  } finally {
    if (!disposed) loading.value = false
  }
}
watch(
  () => props.modelValue,
  (value) => {
    page.value = value
    clamp()
  },
)
watch(page, () => {
  clamp()
  emit('update:modelValue', page.value)
  pdfScroll.value?.scrollTo({ top: 0, left: 0 })
  render()
})
watch(zoom, render)
onMounted(() => {
  openPdf()
  observer = new ResizeObserver(() => {
    const width = pdfScroll.value?.clientWidth
    if (width > 0 && width !== lastWidth) {
      lastWidth = width
      if (zoom.value === 'fit') {
        cancelAnimationFrame(resizeFrame)
        resizeFrame = requestAnimationFrame(render)
      }
    }
  })
  observer.observe(pdfScroll.value)
})
onBeforeUnmount(() => {
  disposed = true
  observer?.disconnect()
  cancelAnimationFrame(resizeFrame)
  renderTask?.cancel()
  textLayer?.cancel()
  loadingTask?.destroy()
})
</script>
<style scoped>
.pdf-document-pane {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
  border: 1px solid #dde3ec;
  border-radius: 12px;
  background: #fff;
}
.pdf-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
  padding: 8px 10px;
  border-bottom: 1px solid #e5e9ef;
  flex-shrink: 0;
}
.page-controls,
.zoom-controls {
  display: flex;
  align-items: center;
  gap: 5px;
}
.pdf-toolbar button,
.pdf-toolbar select {
  font: inherit;
  font-size: 12px;
  border: 1px solid #dce3ed;
  border-radius: 7px;
  padding: 5px 8px;
  background: #fff;
  color: #52667f;
  min-height: 31px;
  cursor: pointer;
}
.pdf-toolbar button:disabled {
  opacity: 0.4;
  cursor: default;
}
.page-controls input {
  width: 49px;
  text-align: center;
  box-sizing: border-box;
  border: 1px solid #dce3ed;
  border-radius: 7px;
  padding: 5px;
  font: inherit;
  font-size: 12px;
}
.page-controls > span {
  font-size: 12px;
  color: #8592a7;
}
.pdf-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 12px;
  background: #dfe4eb;
  box-sizing: border-box;
  scrollbar-gutter: stable;
  overscroll-behavior: contain;
}
.pdf-status {
  padding: 12px;
  font-size: 13px;
  line-height: 1.8;
}
.pdf-page-surface {
  position: relative;
  margin: 0 auto;
  background: white;
}
canvas {
  display: block;
  background: white;
  box-shadow: 0 3px 16px #2432471f;
}
footer {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  padding: 6px 10px;
  font-size: 10px;
  color: #8290a6;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
}
.pdf-text-layer {
  position: absolute;
  inset: 0;
  overflow: clip;
  line-height: 1;
  letter-spacing: normal;
  word-spacing: normal;
  text-align: initial;
  transform-origin: 0 0;
  text-size-adjust: none;
  --scale-round-x: 1px;
  --scale-round-y: 1px;
  --min-font-size: 1;
  --text-scale-factor: calc(var(--total-scale-factor) * var(--min-font-size));
  --min-font-size-inv: calc(1/var(--min-font-size));
  user-select: text;
}
.pdf-text-layer :deep(span),
.pdf-text-layer :deep(br) {
  position: absolute;
  color: transparent;
  white-space: pre;
  cursor: text;
  transform-origin: 0% 0%;
  user-select: text;
}
.pdf-text-layer :deep(span) {
  font-size: calc(var(--text-scale-factor) * var(--font-height));
  transform: rotate(var(--rotate, 0deg)) scaleX(var(--scale-x, 1)) scale(var(--min-font-size-inv));
}
.pdf-text-layer :deep(.markedContent) {
  display: contents;
}
.pdf-text-layer :deep(span::selection) {
  background: #4887e866;
  color: transparent;
}
.pdf-text-layer[data-main-rotation='90'] {
  transform: rotate(90deg) translateY(-100%);
}
.pdf-text-layer[data-main-rotation='180'] {
  transform: rotate(180deg) translate(-100%, -100%);
}
.pdf-text-layer[data-main-rotation='270'] {
  transform: rotate(270deg) translateX(-100%);
}
</style>
