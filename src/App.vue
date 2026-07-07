<template>
  <div class="h-screen flex flex-col bg-white dark:bg-[#0d1117] text-gray-900 dark:text-[#c9d1d9] overflow-hidden font-sans transition-colors duration-200">

    <!-- Toolbar (Mac-like header) -->
    <header class="h-12 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-4 bg-gray-50/80 dark:bg-[#161b22]/80 backdrop-blur-sm select-none z-10">
      <div class="flex items-center space-x-2">
        <button @click="openFile" title="Open File" class="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors cursor-pointer">
          <svg class="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
        </button>
        <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
        <span class="text-sm font-medium text-gray-600 dark:text-gray-300 truncate max-w-[400px]">
          {{ fileName || 'Markfly' }}
        </span>
      </div>
      <div class="flex items-center space-x-1">
        <!-- Zoom controls -->
        <button @click="zoomOut" title="Zoom Out" class="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors cursor-pointer">
          <svg class="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4"></path></svg>
        </button>
        <span class="text-xs font-mono text-gray-500 dark:text-gray-400 w-10 text-center tabular-nums">{{ Math.round(zoom * 100) }}%</span>
        <button @click="zoomIn" title="Zoom In" class="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors cursor-pointer">
          <svg class="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
        </button>
        <button @click="resetZoom" title="Reset Zoom" class="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors cursor-pointer ml-1">
          <svg class="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
        </button>
        <!-- Toggle source/preview -->
        <button @click="toggleRaw" :title="showRaw ? 'Show Preview' : 'Show Source'" class="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors cursor-pointer">
          <svg v-if="!showRaw" class="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path></svg>
          <svg v-else class="w-4 h-4 text-blue-500 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
        </button>
        <div class="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1"></div>
        <button @click="toggleTheme" class="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors cursor-pointer">
          <svg v-if="isDark" class="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
          <svg v-else class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path></svg>
        </button>
      </div>
    </header>

    <!-- Main Content Area -->
    <main class="flex-1 flex flex-col overflow-hidden" @drop.prevent="onWebDrop" @dragover.prevent">

      <!-- Empty State -->
      <div v-if="!content" @click="openFile" class="flex-1 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 cursor-pointer">
        <div class="w-24 h-24 mb-6 border-4 border-dashed border-gray-300 dark:border-gray-700 rounded-xl flex items-center justify-center bg-gray-50 dark:bg-[#161b22]">
          <svg class="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
        </div>
        <p class="text-xl font-medium text-gray-600 dark:text-gray-300">Drag & Drop a Markdown file</p>
        <p class="text-sm mt-2">Click anywhere or drag &amp; drop a .md file</p>
      </div>

      <!-- Markdown Viewer with GitHub theme class -->
      <div v-else class="flex-1 w-full bg-white dark:bg-[#0d1117] transition-colors duration-200 markdown-scroll" :data-theme="isDark ? 'dark' : 'light'">
        <!-- Raw source mode -->
        <div v-if="showRaw" class="h-full p-4 overflow-auto">
          <pre class="text-sm font-mono text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-all">{{ content }}</pre>
        </div>
        <!-- Rendered preview mode -->
        <article
          v-else
          class="markdown-body"
          :style="{ fontSize: `${zoom * 100}%` }"
          v-html="rendered">
        </article>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { marked } from 'marked'
import hljs from 'highlight.js'
// github-markdown-css v5 hard-codes colors (no CSS vars), so load both
// light & dark variants as togglable stylesheets — same pattern as hljs below.
import mdLightUrl from 'github-markdown-css/github-markdown-light.css?url'
import mdDarkUrl from 'github-markdown-css/github-markdown-dark.css?url'
import lightHljsUrl from 'highlight.js/styles/github.css?url'
import darkHljsUrl from 'highlight.js/styles/github-dark.css?url'

const content = ref('')
const fileName = ref('')
const currentFilePath = ref('')
const isDark = ref(false)
const zoom = ref(1)
const showRaw = ref(false)

function zoomIn() {
  zoom.value = Math.min(zoom.value + 0.1, 2)
}

function zoomOut() {
  zoom.value = Math.max(zoom.value - 0.1, 0.5)
}

function resetZoom() {
  zoom.value = 1
}

const rendered = computed(() => {
  return marked.parse(content.value, {
    async: false,
    walkTokens(token) {
      if (token.type === 'code') {
        const lang = hljs.getLanguage(token.lang ?? '') ? (token.lang ?? '') : 'plaintext'
        token.text = hljs.highlight(token.raw, { language: lang }).value
      }
    }
  }) as string
})

async function toggleTheme() {
  isDark.value = !isDark.value
  applyTheme(isDark.value)
  await window.electronAPI.savePref({ dark: isDark.value })
}

function applyTheme(dark: boolean) {
  document.documentElement.classList.toggle('dark', dark)
  document.getElementById('hljs-light')?.toggleAttribute('disabled', dark)
  document.getElementById('hljs-dark')?.toggleAttribute('disabled', !dark)
  document.getElementById('md-light')?.toggleAttribute('disabled', dark)
  document.getElementById('md-dark')?.toggleAttribute('disabled', !dark)
}

function toggleRaw() {
  showRaw.value = !showRaw.value
}

async function openFile() {
  try {
    const filePath = await window.electronAPI.openFileDialog()
    if (filePath) {
      await loadFileContent(filePath)
    }
  } catch (err) {
    console.error("Open file error:", err)
  }
}

async function loadFileContent(filePath: string) {
  try {
    const text = await window.electronAPI.readFile(filePath)
    content.value = text
    currentFilePath.value = filePath
    fileName.value = filePath.split('/').pop() || 'Unknown'

    await window.electronAPI.watchFile(filePath)
    await window.electronAPI.openFilePath(filePath)
  } catch (err) {
    console.error("Gagal membaca file:", err)
  }
}

async function onWebDrop(e: DragEvent) {
  const file = e.dataTransfer?.files[0]
  if (file && (file.name.endsWith('.md') || file.name.endsWith('.markdown'))) {
    fileName.value = file.name
    content.value = await file.text()
  }
}

onMounted(async () => {
  // Inject hljs themes as togglable <link> elements
  // ponytail: ?url gives Vite-resolved URL — works in dev & prod
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

  window.electronAPI.onFileChanged(async () => {
    if (currentFilePath.value) {
      await loadFileContent(currentFilePath.value)
    }
  })

  window.electronAPI.onOpenFile(async (path: string) => {
    if (path.endsWith('.md') || path.endsWith('.markdown')) {
      await loadFileContent(path)
    }
  })

  try {
    const filePath = await window.electronAPI.getArgs()
    if (filePath && (filePath.endsWith('.md') || filePath.endsWith('.markdown'))) {
      await loadFileContent(filePath)
    }
  } catch {
    // no args
  }

  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey) {
      if (e.key === '=' || e.key === '+') {
        e.preventDefault()
        zoomIn()
      } else if (e.key === '-') {
        e.preventDefault()
        zoomOut()
      } else if (e.key === '0') {
        e.preventDefault()
        resetZoom()
      }
    }
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
