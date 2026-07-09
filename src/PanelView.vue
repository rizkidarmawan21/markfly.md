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
