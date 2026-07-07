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
        class="flex items-start gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors select-none"
        :class="tab.path === activePath
          ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300'
          : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'"
      >
        <svg class="w-4 h-4 mt-0.5 flex-shrink-0 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
        <div class="min-w-0 flex-1">
          <div class="text-sm font-medium truncate">{{ tab.name }}</div>
          <div class="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">{{ tab.path }}</div>
        </div>
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
</script>
