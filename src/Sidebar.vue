<template>
  <div
    v-show="visible"
    class="h-full flex-shrink-0 flex flex-col border-r border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-[#161b22]/50 overflow-hidden relative"
    :style="{ width: width + 'px' }"
  >
    <div class="p-3 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 select-none">
      Files
    </div>
    <div class="flex-1 overflow-y-auto px-2 pb-2 space-y-1">
      <div v-if="tabs.length === 0" class="text-sm text-gray-400 dark:text-gray-500 text-center mt-8">
        No files open
      </div>
      <div
        v-for="tab in tabs"
        :key="tab.path"
        @click="$emit('select', tab.path)"
        @dragstart="onDragStart($event, tab.path)"
        draggable="true"
        class="group flex items-start gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors select-none"
        :class="tab.path === activePath
          ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300'
          : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'"
      >
        <svg class="w-4 h-4 mt-0.5 flex-shrink-0 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
        <div class="min-w-0 flex-1">
          <div class="text-xs font-medium truncate">{{ tab.name }}</div>
          <div class="text-[11px] text-gray-400 dark:text-gray-500 truncate mt-0.5">{{ displayPath(tab.path) }}</div>
        </div>
        <button
          @click.stop="$emit('close', tab.path)"
          class="p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-500 dark:hover:text-red-400 flex-shrink-0 transition-colors opacity-0 group-hover:opacity-100"
          title="Remove from history"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
    <!-- Resize handle -->
    <div
      class="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-indigo-400/30 active:bg-indigo-400/50 transition-colors"
      @mousedown.prevent="startResize"
    ></div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  tabs: TabItem[]
  activePath: string | null
  width: number
  visible: boolean
}>()

const emit = defineEmits<{
  select: [path: string]
  'update:width': [width: number]
  close: [path: string]
}>()

function startResize(e: MouseEvent) {
  const startX = e.clientX
  const startWidth = (e.currentTarget as HTMLElement).parentElement!.offsetWidth
  function onMove(ev: MouseEvent) {
    const newWidth = Math.max(180, Math.min(400, startWidth + ev.clientX - startX))
    emit('update:width', newWidth)
  }
  function onUp() {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
  }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

function onDragStart(e: DragEvent, path: string) {
  e.dataTransfer?.setData('text/plain', path)
}

function displayPath(p: string): string {
  return p.replace(/^\/Users\/[^/]+/, '~')
}
</script>
