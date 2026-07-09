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
        <template v-if="activePath">
          <button @click="zoom = Math.max(0.5, zoom - 0.1)" class="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors cursor-pointer" title="Zoom out">
            <svg class="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4" /></svg>
          </button>
          <span class="text-xs text-gray-400 dark:text-gray-500 select-none w-8 text-center">{{ Math.round(zoom * 100) }}%</span>
          <button @click="zoom = Math.min(3, zoom + 0.1)" class="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors cursor-pointer" title="Zoom in">
            <svg class="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
          </button>
          <button @click="showRaw = !showRaw" :title="showRaw ? 'Show Preview' : 'Show Source'" class="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors cursor-pointer">
            <svg v-if="!showRaw" class="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
            <svg v-else class="w-4 h-5 text-blue-500 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          </button>
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

        <!-- Empty state -->
        <div v-if="!activePath" @click="openFile" class="flex-1 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 cursor-pointer">
          <div class="w-24 h-24 mb-6 border-4 border-dashed border-gray-300 dark:border-gray-700 rounded-xl flex items-center justify-center bg-gray-50 dark:bg-[#161b22]">
            <svg class="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
          </div>
          <p class="text-sm font-medium text-gray-600 dark:text-gray-300">Drop .md here or click to open</p>
        </div>

        <!-- Preview area -->
        <div v-else class="flex-1 w-full bg-white dark:bg-[#0d1117] transition-colors duration-200 markdown-scroll" :data-theme="isDark ? 'dark' : 'light'">
          <div v-if="showRaw" class="h-full p-4 overflow-auto">
            <pre class="text-sm font-mono text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-all">{{ fileContents[activePath] || '' }}</pre>
          </div>
          <article
            v-else
            class="markdown-body"
            :style="{ fontSize: `${zoom * 100}%` }"
            v-html="rendered">
          </article>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { marked } from 'marked'
import hljs from 'highlight.js'
import mdLightUrl from 'github-markdown-css/github-markdown-light.css?url'
import mdDarkUrl from 'github-markdown-css/github-markdown-dark.css?url'
import lightHljsUrl from 'highlight.js/styles/github.css?url'
import darkHljsUrl from 'highlight.js/styles/github-dark.css?url'
import Sidebar from './Sidebar.vue'
import TabBar from './TabBar.vue'

const tabs = ref<TabItem[]>([])

const activeTabs = computed(() => tabs.value.filter(t => t.active !== false))
const activePath = ref<string | null>(null)
const fileContents = ref<Record<string, string>>({})
const isDark = ref(false)
const zoom = ref(1)
const showRaw = ref(false)
const sidebarVisible = ref(false)
const sidebarWidth = ref(260)

const activeTab = computed(() => tabs.value.find(t => t.path === activePath.value))

const rendered = computed(() => {
  const content = activePath.value ? fileContents.value[activePath.value] || '' : ''
  return marked.parse(content, {
    async: false,
    walkTokens(token) {
      if (token.type === 'code') {
        const lang = hljs.getLanguage(token.lang ?? '') ? (token.lang ?? '') : 'plaintext'
        token.text = hljs.highlight(token.raw, { language: lang }).value
      }
    }
  }) as string
})

async function saveState() {
  await window.electronAPI.savePref({
    dark: isDark.value,
    sidebarVisible: sidebarVisible.value,
    sidebarWidth: sidebarWidth.value,
    tabs: tabs.value.map(t => ({ path: t.path, active: t.active })),
    activePath: activePath.value,
    zoom: zoom.value,
    showRaw: showRaw.value,
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
    saveState()
    return
  }
  const name = path.split('/').pop() || 'Unknown'
  tabs.value.push({ path, name, active: true })
  activePath.value = path
  await loadFileContent(path)
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
    const oldIdx = tabs.value.findIndex(t => t.path === path)
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

async function onWebDrop(e: DragEvent) {
  const file = e.dataTransfer?.files[0]
  if (file && (file.name.endsWith('.md') || file.name.endsWith('.markdown'))) {
    const text = await file.text()
    const fakePath = 'file://' + file.name
    fileContents.value[fakePath] = text
    if (!tabs.value.find(t => t.path === fakePath)) {
      tabs.value.push({ path: fakePath, name: file.name, active: true })
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
  if (pref && typeof pref.zoom === 'number') zoom.value = pref.zoom
  if (pref && typeof pref.showRaw === 'boolean') showRaw.value = pref.showRaw

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
