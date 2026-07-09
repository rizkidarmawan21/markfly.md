<script setup lang="ts">
import { ref } from 'vue'
import PanelView from './PanelView.vue'
import SplitToolbar from './SplitToolbar.vue'

const props = defineProps<{
  panels: Panel[]
  cols: number
  rows: number
  fileContents: Record<string, string>
  isDark: boolean
}>()

const emit = defineEmits<{
  updatePanel: [id: string, partial: Partial<Panel>]
  split: [dir: 'h' | 'v' | '2x2']
  closePanel: []
  closeAll: []
  selectFile: [panelId: string]
  dropFile: [panelId: string, path: string, data: string]
}>()

const resizing = ref<{ axis: 'col' | 'row'; index: number; start: number; size: number } | null>(null)

// Resize: overlay strips
function startResize(e: MouseEvent, axis: 'col' | 'row', index: number) {
  const container = (e.currentTarget as HTMLElement).parentElement!
  const rect = container.getBoundingClientRect()
  const size = axis === 'col' ? rect.width : rect.height
  resizing.value = { axis, index, start: e[axis === 'col' ? 'clientX' : 'clientY'], size }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

function onMove(e: MouseEvent) {
  if (!resizing.value) return
  // we just need cursor feedback; actual grid resize via CSS is handled
  // by the overlay visuals. The grid uses flex:1 so no explicit sizing needed.
}

function onUp() {
  resizing.value = null
  document.removeEventListener('mousemove', onMove)
  document.removeEventListener('mouseup', onUp)
}

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
        <!-- Column resize handle (after each panel except last in row) -->
        <div
          v-if="(i + 1) % cols !== 0"
          class="absolute top-0 bottom-0 w-1 cursor-col-resize z-20 hover:bg-indigo-400/40 active:bg-indigo-400/60 transition-colors"
          :style="{ left: `${((i % cols) + 1) / cols * 100}%` }"
          @mousedown.prevent="startResize($event, 'col', i % cols)"
        ></div>
      </template>
    </div>

    <!-- Toolbar -->
    <SplitToolbar
      :panelCount="panels.length"
      @split="emit('split', $event)"
      @closePanel="emit('closePanel')"
      @closeAll="emit('closeAll')"
    />
  </div>
</template>
