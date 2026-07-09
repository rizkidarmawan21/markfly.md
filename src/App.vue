<template>
  <div class="h-screen flex flex-col bg-white dark:bg-[#0d1117] text-gray-900 dark:text-[#c9d1d9] overflow-hidden font-sans transition-colors duration-200">
    <header class="h-12 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-4 bg-gray-50/80 dark:bg-[#161b22]/80 backdrop-blur-sm select-none z-10">
      <div class="flex items-center space-x-2">
        <button @click="toggleSidebar" title="Toggle Sidebar" class="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors cursor-pointer">
          <svg class="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <button @click="openFile" title="Open File" class="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors cursor-pointer">
          <svg class="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
        </button>
        <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
        <span class="text-sm font-medium text-gray-600 dark:text-gray-300 truncate max-w-[400px]">
          {{ activeTab ? activeTab.name : 'Markfly' }}
        </span>
      </div>
      <div class="flex items-center space-x-1">
        <!-- Zoom & raw toggle (applies to active panel) -->
        <template v-if="activePanel">
          <button @click="activePanel.zoom = Math.max(0.5, activePanel.zoom - 0.1)" class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-xs leading-none text-gray-500 dark:text-gray-400 cursor-pointer" title="Zoom out">−</button>
          <span class="text-xs text-gray-400 dark:text-gray-500 select-none w-8 text-center">{{ Math.round(activePanel.zoom * 100) }}%</span>
          <button @click="activePanel.zoom = Math.min(3, activePanel.zoom + 0.1)" class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-xs leading-none text-gray-500 dark:text-gray-400 cursor-pointer" title="Zoom in">+</button>
          <button @click="activePanel.showRaw = !activePanel.showRaw" class="px-2 py-0.5 rounded text-xs leading-none cursor-pointer transition-colors"
            :class="activePanel.showRaw ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300' : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400'" title="Toggle raw/preview">&lt;/&gt;</button>
          <div class="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1"></div>
        </template>
        <button @click="toggleTheme" class="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors cursor-pointer">
          <svg v-if="isDark" class="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
          <svg v-else class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
        </button>
      </div>
    </header>

    <main class="flex-1 flex overflow-hidden" @drop.prevent="onWebDrop" @dragover.prevent>
      <!-- Sidebar -->
      <Sidebar
        :tabs="tabs"
        :activePath="activePath"
        :width="sidebarWidth"
        :visible="sidebarVisible"
        @select="selectFile"
        @update:width="w => sidebarWidth = w"
        @close="removeTab"
      />

      <!-- Content area -->
      <div class="flex-1 flex flex-col overflow-hidden">
        <TabBar
          :tabs="activeTabs"
          :activePath="activePath"
          @select="selectFile"
          @close="closeTab"
        />

        <!-- Panel grid area -->
        <PanelGrid
          :panels="panels"
          :cols="gridCols"
          :rows="gridRows"
          :fileContents="fileContents"
          :isDark="isDark"
          @split="onSplit"
          @closePanel="onClosePanel"
          @closeAll="onCloseAll"
          @selectFile="onPanelSelectFile"
          @dropFile="onPanelDropFile"
        />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import mdLightUrl from 'github-markdown-css/github-markdown-light.css?url'
import mdDarkUrl from 'github-markdown-css/github-markdown-dark.css?url'
import lightHljsUrl from 'highlight.js/styles/github.css?url'
import darkHljsUrl from 'highlight.js/styles/github-dark.css?url'
import Sidebar from './Sidebar.vue'
import TabBar from './TabBar.vue'
import PanelGrid from './PanelGrid.vue'

const tabs = ref<TabItem[]>([])

const activeTabs = computed(() => tabs.value.filter(t => t.active !== false))
const activePath = ref<string | null>(null)
const fileContents = ref<Record<string, string>>({})
const isDark = ref(false)
const sidebarVisible = ref(false)
const sidebarWidth = ref(260)

// Panel state
const panels = ref<Panel[]>([{ id: 'p1', path: null, zoom: 1, showRaw: false }])
const gridCols = ref(1)
const gridRows = ref(1)

const activeTab = computed(() => tabs.value.find(t => t.path === activePath.value))
const activePanel = computed(() => panels.value.find(p => p.path === activePath.value))

// ponytail: deep watch on panels saves zoom/raw changes from header controls
watch(panels, saveState, { deep: true })

async function saveState() {
  await window.electronAPI.savePref({
    dark: isDark.value,
    sidebarVisible: sidebarVisible.value,
    sidebarWidth: sidebarWidth.value,
    tabs: tabs.value.map(t => ({ path: t.path, active: t.active })),
    activePath: activePath.value,
    panelLayout: {
      cols: gridCols.value,
      rows: gridRows.value,
      panels: panels.value.map(p => ({ ...p })),
    },
  })
}

function toggleSidebar() {
  sidebarVisible.value = !sidebarVisible.value
  saveState()
}

async function selectFile(path: string) {
  const existing = tabs.value.find(t => t.path === path)
  if (existing) {
    existing.active = true
    activePath.value = path
    if (!fileContents.value[path]) {
      await loadFileContent(path)
    }
    // assign to first panel
    const panel = panels.value.find(p => !p.path) || panels.value[0]
    if (panel) { panel.path = path }
    saveState()
    return
  }
  const name = path.split('/').pop() || 'Unknown'
  tabs.value.push({ path, name, active: true })
  activePath.value = path
  await loadFileContent(path)
  // assign to first empty panel or first panel
  const panel = panels.value.find(p => !p.path) || panels.value[0]
  if (panel) { panel.path = path }
  saveState()
}

async function removeTab(path: string) {
  const idx = tabs.value.findIndex(t => t.path === path)
  if (idx === -1) return
  tabs.value.splice(idx, 1)
  delete fileContents.value[path]
  if (path === activePath.value) {
    const active = activeTabs.value
    if (active.length === 0) {
      activePath.value = null
    } else {
      const nextIdx = Math.min(idx, active.length - 1)
      activePath.value = active[nextIdx].path
    }
  }
  saveState()
}

async function closeTab(path: string) {
  const tab = tabs.value.find(t => t.path === path)
  if (!tab) return
  tab.active = false
  delete fileContents.value[path]
  if (path === activePath.value) {
    const active = activeTabs.value
    const oldIdx = tabs.value.findIndex(t => t.path === path)
    // pick nearest active tab by original index
    let next: TabItem | null = null
    for (let i = oldIdx + 1; i < tabs.value.length; i++) {
      if (tabs.value[i].active !== false) { next = tabs.value[i]; break }
    }
    if (!next) {
      for (let i = oldIdx - 1; i >= 0; i--) {
        if (tabs.value[i].active !== false) { next = tabs.value[i]; break }
      }
    }
    activePath.value = next ? next.path : null
  }
  saveState()
}

async function loadFileContent(filePath: string) {
  try {
    const text = await window.electronAPI.readFile(filePath)
    fileContents.value[filePath] = text ?? '> Permission denied — unable to read this file.'
    if (text) {
      await window.electronAPI.watchFile(filePath)
      await window.electronAPI.openFilePath(filePath)
    }
  } catch (err) {
    console.error('Error reading file:', err)
  }
}

async function openFile() {
  try {
    const filePath = await window.electronAPI.openFileDialog()
    if (filePath) {
      await selectFile(filePath)
    }
  } catch (err) {
    console.error('Open file error:', err)
  }
}

// --- Panel handlers ---

function onSplit(dir: 'h' | 'v' | '2x2') {
  if (dir === 'v') {
    gridCols.value = 2
    gridRows.value = 1
    panels.value.push({ id: 'p2', path: null, zoom: 1, showRaw: false })
  } else if (dir === 'h') {
    gridCols.value = 1
    gridRows.value = 2
    panels.value.push({ id: 'p2', path: null, zoom: 1, showRaw: false })
  } else if (dir === '2x2') {
    gridCols.value = 2
    gridRows.value = 2
    if (panels.value.length === 2) {
      panels.value.push({ id: 'p3', path: null, zoom: 1, showRaw: false })
      panels.value.push({ id: 'p4', path: null, zoom: 1, showRaw: false })
    }
  }
  saveState()
}

function onClosePanel() {
  if (panels.value.length <= 1) return
  panels.value.pop()
  if (panels.value.length <= 2 && gridRows.value === 1) gridCols.value = panels.value.length
  else if (panels.value.length <= 2 && gridCols.value === 1) gridRows.value = panels.value.length
  else if (panels.value.length === 1) { gridCols.value = 1; gridRows.value = 1 }
  saveState()
}

function onCloseAll() {
  panels.value = [{ id: 'p1', path: null, zoom: 1, showRaw: false }]
  gridCols.value = 1
  gridRows.value = 1
  saveState()
}

function onPanelSelectFile() {
  openFile()
}

function onPanelDropFile(panelId: string, path: string, data: string) {
  fileContents.value[path] = data
  if (!tabs.value.find(t => t.path === path)) {
    const name = path.split('/').pop() || 'Unknown'
    tabs.value.push({ path, name, active: true })
  }
  const panel = panels.value.find(p => p.id === panelId)
  if (panel) {
    panel.path = path
    panel.zoom = 1
    panel.showRaw = false
  }
  activePath.value = path
  saveState()
}

async function onWebDrop(e: DragEvent) {
  const file = e.dataTransfer?.files[0]
  if (file && (file.name.endsWith('.md') || file.name.endsWith('.markdown'))) {
    const text = await file.text()
    const fakePath = 'file://' + file.name
    fileContents.value[fakePath] = text
    if (!tabs.value.find(t => t.path === fakePath)) {
      tabs.value.push({ path: fakePath, name: file.name, active: true })
    }
    const target = panels.value.find(p => !p.path) || panels.value[0]
    if (target) {
      target.path = fakePath
      target.zoom = 1
      target.showRaw = false
    }
    activePath.value = fakePath
    saveState()
  }
}

async function toggleTheme() {
  isDark.value = !isDark.value
  applyTheme(isDark.value)
  await saveState()
}

function applyTheme(dark: boolean) {
  document.documentElement.classList.toggle('dark', dark)
  document.getElementById('hljs-light')?.toggleAttribute('disabled', dark)
  document.getElementById('hljs-dark')?.toggleAttribute('disabled', !dark)
  document.getElementById('md-light')?.toggleAttribute('disabled', dark)
  document.getElementById('md-dark')?.toggleAttribute('disabled', !dark)
}

onMounted(async () => {
  const mkLink = (id: string, url: string, disabled: boolean) => {
    const link = document.createElement('link')
    link.id = id
    link.rel = 'stylesheet'
    link.href = url
    if (disabled) link.setAttribute('disabled', 'disabled')
    document.head.appendChild(link)
  }

  const pref = await window.electronAPI.loadPref()
  const initialDark = (pref && typeof pref.dark === 'boolean') ? pref.dark : window.matchMedia('(prefers-color-scheme: dark)').matches
  mkLink('hljs-light', lightHljsUrl, initialDark)
  mkLink('hljs-dark', darkHljsUrl, !initialDark)
  mkLink('md-light', mdLightUrl, initialDark)
  mkLink('md-dark', mdDarkUrl, !initialDark)
  isDark.value = initialDark
  applyTheme(initialDark)

  // Restore sidebar state
  if (pref && typeof pref.sidebarVisible === 'boolean') sidebarVisible.value = pref.sidebarVisible
  if (pref && typeof pref.sidebarWidth === 'number') sidebarWidth.value = pref.sidebarWidth

  // Restore tabs
  if (pref && Array.isArray(pref.tabs)) {
    for (const p of pref.tabs) {
      const path = typeof p === 'string' ? p : p.path
      const active = typeof p === 'string' ? true : p.active !== false
      const name = path.split('/').pop() || 'Unknown'
      tabs.value.push({ path, name, active })
      if (active) {
        try {
          const text = await window.electronAPI.readFile(path)
          fileContents.value[path] = text ?? '> Permission denied — unable to read this file.'
        } catch (e) { console.error('Failed to restore file:', path, e) }
      }
    }
    const restoredActive = activeTabs.value
    if (pref.activePath && tabs.value.some(t => t.path === (pref.activePath as string))) {
      activePath.value = pref.activePath as string
    } else if (restoredActive.length > 0) {
      activePath.value = restoredActive[0].path
    }
  }

  // Restore panel layout
  if (pref?.panelLayout) {
    const pl = pref.panelLayout as PanelLayout
    gridCols.value = pl.cols
    gridRows.value = pl.rows
    panels.value = pl.panels.map(p => ({ ...p }))
    if (panels.value.length === 0) {
      panels.value.push({ id: 'p1', path: null, zoom: 1, showRaw: false })
    }
  }

  window.electronAPI.onFileChanged(async () => {
    if (activePath.value) {
      await loadFileContent(activePath.value)
    }
  })

  window.electronAPI.onOpenFile(async (path: string) => {
    if (path.endsWith('.md') || path.endsWith('.markdown')) {
      await selectFile(path)
    }
  })

  try {
    const filePath = await window.electronAPI.getArgs()
    if (filePath && (filePath.endsWith('.md') || filePath.endsWith('.markdown'))) {
      await selectFile(filePath)
    }
  } catch { /* no args */ }

  window.addEventListener('beforeunload', () => {
    saveState()
  })
})
</script>

<style>
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: rgba(156, 163, 175, 0.5);
  border-radius: 4px;
}
.dark ::-webkit-scrollbar-thumb {
  background: rgba(75, 85, 99, 0.5);
}
</style>
