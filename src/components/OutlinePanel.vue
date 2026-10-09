<template>
  <aside class="w-80 max-w-[40vw] shrink-0 border-l border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#0d1117] flex flex-col overflow-hidden">
    <header class="h-11 shrink-0 flex items-center justify-between px-4 border-b border-gray-200 dark:border-gray-800">
      <h2 class="text-xs font-semibold tracking-wide text-gray-500 dark:text-gray-400">OUTLINE</h2>
      <button @click="$emit('close')" title="Close outline" aria-label="Close outline" class="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-800 cursor-pointer">
        <svg class="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-width="2" d="m6 9 6 6 6-6"/></svg>
      </button>
    </header>
    <div class="min-h-0 flex-1 overflow-y-auto py-2">
      <div class="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 truncate" :title="documentTitle">{{ documentTitle }}</div>
      <nav v-if="headings.length" aria-label="Document outline" class="pb-3">
        <button
          v-for="heading in headings"
          :key="heading.id"
          @click="$emit('select', heading.id)"
          class="block w-full px-4 py-1.5 text-left text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100 truncate cursor-pointer transition-colors"
          :style="{ paddingLeft: `${16 + (heading.level - 1) * 18}px` }"
          :title="heading.text"
        >{{ heading.text }}</button>
      </nav>
      <p v-else class="px-4 py-2 text-sm text-gray-400 dark:text-gray-500">No headings</p>
    </div>
  </aside>
</template>

<script setup lang="ts">
defineProps<{
  documentTitle: string
  headings: { id: string; level: number; text: string }[]
}>()

defineEmits<{
  close: []
  select: [id: string]
}>()
</script>
