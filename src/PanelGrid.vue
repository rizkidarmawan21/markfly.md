<script setup lang="ts">
import PanelView from './PanelView.vue'

const props = defineProps<{
  panels: Panel[]
  cols: number
  rows: number
  fileContents: Record<string, string>
  isDark: boolean
}>()

const emit = defineEmits<{
  split: [dir: 'h' | 'v' | '2x2']
  closePanel: []
  selectFile: [panelId: string]
  dropFile: [panelId: string, path: string, data: string]
}>()

function onPanelDrop(panelId: string, path: string, data: string) {
  emit('dropFile', panelId, path, data)
}

function getContent(panel: Panel): string {
  return panel.path ? (props.fileContents[panel.path] || '') : ''
}
</script>

<template>
  <div class="flex-1 relative overflow-hidden">
    <!-- 1×1: no grid wrapper, backward compat -->
    <div v-if="panels.length === 1" class="h-full w-full">
      <PanelView
        :panel="panels[0]"
        :content="getContent(panels[0])"
        :isDark="isDark"
        @selectFile="emit('selectFile', $event)"
        @dropFile="onPanelDrop"
      />
    </div>

    <!-- Multi-panel grid -->
    <div
      v-else
      class="h-full w-full grid"
      :style="{
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
        gap: '3px',
      }"
    >
      <template v-for="(panel, i) in panels" :key="panel.id">
        <div class="relative overflow-hidden rounded-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#0d1117]">
          <PanelView
            :panel="panel"
            :content="getContent(panel)"
            :isDark="isDark"
            @selectFile="emit('selectFile', $event)"
            @dropFile="onPanelDrop"
          />
        </div>
      </template>
    </div>
  </div>
</template>
