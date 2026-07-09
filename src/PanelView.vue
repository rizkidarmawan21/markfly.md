<script setup lang="ts">
import { computed } from 'vue'
import { marked } from 'marked'
import hljs from 'highlight.js'

const props = defineProps<{
  panel: Panel
  content: string
  isDark: boolean
}>()

const emit = defineEmits<{
  selectFile: [panelId: string]
  dropFile: [panelId: string, path: string, data: string]
  updatePanel: [panelId: string, partial: Partial<Panel>]
}>()

const rendered = computed(() => {
  if (!props.content) return ''
  return marked.parse(props.content, {
    async: false,
    walkTokens(token) {
      if (token.type === 'code') {
        const lang = hljs.getLanguage(token.lang ?? '') ? (token.lang ?? '') : 'plaintext'
        token.text = hljs.highlight(token.raw, { language: lang }).value
      }
    }
  }) as string
})

function onClickEmpty() {
  emit('selectFile', props.panel.id)
}

function onDrop(e: DragEvent) {
  const file = e.dataTransfer?.files[0]
  if (file && (file.name.endsWith('.md') || file.name.endsWith('.markdown'))) {
    file.text().then(text => {
      emit('dropFile', props.panel.id, 'file://' + file.name, text)
    })
  }
}
</script>

<template>
  <div
    class="h-full w-full flex flex-col"
    @drop.prevent="onDrop"
    @dragover.prevent
    :data-theme="isDark ? 'dark' : 'light'"
  >
    <!-- Toolbar: zoom & raw toggle (only when file open) -->
    <div v-if="panel.path" class="flex items-center justify-end gap-1 px-2 py-1 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-[#161b22]/50">
      <button
        @click="emit('updatePanel', panel.id, { zoom: Math.max(0.5, panel.zoom - 0.1) })"
        class="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 text-xs leading-none cursor-pointer"
        title="Zoom out"
      >−</button>
      <span class="text-xs text-gray-400 dark:text-gray-500 select-none w-8 text-center">{{ Math.round(panel.zoom * 100) }}%</span>
      <button
        @click="emit('updatePanel', panel.id, { zoom: Math.min(3, panel.zoom + 0.1) })"
        class="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 text-xs leading-none cursor-pointer"
        title="Zoom in"
      >+</button>
      <div class="w-px h-4 mx-1 bg-gray-200 dark:bg-gray-700"></div>
      <button
        @click="emit('updatePanel', panel.id, { showRaw: !panel.showRaw })"
        class="px-2 py-0.5 rounded text-xs leading-none cursor-pointer transition-colors"
        :class="panel.showRaw
          ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300'
          : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400'"
        title="Toggle raw/preview"
      >&lt;/&gt;</button>
    </div>

    <!-- Empty state -->
    <div
      v-if="!panel.path"
      class="flex-1 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 cursor-pointer overflow-auto"
      @click="onClickEmpty"
    >
      <div class="w-16 h-16 mb-4 border-4 border-dashed border-gray-300 dark:border-gray-700 rounded-xl flex items-center justify-center bg-gray-50 dark:bg-[#161b22]">
        <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
      </div>
      <p class="text-sm font-medium text-gray-600 dark:text-gray-300">Drop .md here or click to open</p>
    </div>

    <!-- Raw view -->
    <div v-else-if="panel.showRaw" class="flex-1 overflow-auto p-4">
      <pre class="text-sm font-mono text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-all">{{ content || '' }}</pre>
    </div>

    <!-- Rendered preview -->
    <article
      v-else
      class="markdown-body flex-1 overflow-auto p-4"
      :style="{ fontSize: `${panel.zoom * 100}%` }"
      v-html="rendered"
    ></article>
  </div>
</template>
