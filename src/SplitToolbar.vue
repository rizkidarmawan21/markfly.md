<script setup lang="ts">
defineProps<{
  panelCount: number
}>()

const emit = defineEmits<{
  split: [dir: 'h' | 'v' | '2x2']
  closePanel: []
  closeAll: []
}>()
</script>

<template>
  <div class="absolute top-2 right-2 flex items-center gap-1 z-10">
    <button
      v-if="panelCount < 4 && panelCount <= 2"
      @click="emit('split', 'v')"
      title="Split Vertical (1×2)"
      class="p-1.5 rounded-md bg-gray-100 dark:bg-[#21262d] hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors cursor-pointer border border-gray-200 dark:border-gray-700 shadow-sm"
    >
      <svg class="w-4 h-4" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="1" width="6" height="14" rx="1"/><rect x="9" y="1" width="6" height="14" rx="1"/></svg>
    </button>
    <button
      v-if="panelCount < 4 && panelCount <= 2"
      @click="emit('split', 'h')"
      title="Split Horizontal (2×1)"
      class="p-1.5 rounded-md bg-gray-100 dark:bg-[#21262d] hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors cursor-pointer border border-gray-200 dark:border-gray-700 shadow-sm"
    >
      <svg class="w-4 h-4" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="1" width="14" height="6" rx="1"/><rect x="1" y="9" width="14" height="6" rx="1"/></svg>
    </button>
    <button
      v-if="panelCount === 2"
      @click="emit('split', '2x2')"
      title="Split 2×2"
      class="p-1.5 rounded-md bg-gray-100 dark:bg-[#21262d] hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors cursor-pointer border border-gray-200 dark:border-gray-700 shadow-sm"
    >
      <svg class="w-4 h-4" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="1" width="6" height="6" rx="1"/><rect x="9" y="1" width="6" height="6" rx="1"/><rect x="1" y="9" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/></svg>
    </button>
    <button
      v-if="panelCount > 1"
      @click="emit('closePanel')"
      title="Close Panel"
      class="p-1.5 rounded-md bg-gray-100 dark:bg-[#21262d] hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-500 dark:text-gray-400 hover:text-red-500 transition-colors cursor-pointer border border-gray-200 dark:border-gray-700 shadow-sm"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
    </button>
  </div>
</template>
