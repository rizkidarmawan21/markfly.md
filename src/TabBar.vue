<template>
  <div v-if="tabs.length > 0" class="tab-bar flex items-center h-9 bg-gray-50 dark:bg-[#161b22] border-b border-gray-200 dark:border-gray-700 overflow-hidden select-none">
    <div class="flex items-center overflow-x-auto overflow-y-hidden h-full scrollbar-none" ref="tabContainer">
      <div
        v-for="tab in tabs"
        :key="tab.path"
        @click="$emit('select', tab.path)"
        :ref="el => { if (tab.path === activePath && el) tabRefs[tab.path] = el as HTMLElement }"
        class="group flex items-center gap-1.5 px-3 h-full text-sm cursor-pointer border-r border-gray-200 dark:border-gray-700 whitespace-nowrap transition-colors shrink-0 max-w-[180px]"
        :class="tab.path === activePath
          ? 'bg-white dark:bg-[#0d1117] border-b-2 border-b-indigo-500 text-gray-900 dark:text-gray-100'
          : 'bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400'"
      >
        <span class="truncate min-w-0">{{ tab.name }}</span>
        <button
          @click.stop="$emit('close', tab.path)"
          class="p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-500 dark:hover:text-red-400 flex-shrink-0 transition-colors"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

defineProps<{
  tabs: TabItem[]
  activePath: string | null
}>()

const emit = defineEmits<{
  select: [path: string]
  close: [path: string]
}>()

const tabRefs = ref<Record<string, HTMLElement>>({})

watch(() => tabRefs.value, (refs) => {
  const entries = Object.entries(refs)
  for (const [, el] of entries) {
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
  }
}, { deep: true })
</script>

<style scoped>
.scrollbar-none::-webkit-scrollbar { display: none; }
.scrollbar-none { scrollbar-width: none; }
</style>
