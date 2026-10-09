<template>
  <div class="app-shell h-screen flex flex-col bg-white dark:bg-[#181715] text-gray-900 dark:text-[#faf9f5] overflow-hidden font-sans transition-colors duration-200">
    <header class="app-topbar h-12 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-4 bg-gray-50/80 dark:bg-[#252320]/80 backdrop-blur-sm select-none z-10">
      <div class="flex items-center space-x-2">
        <button @click="toggleSidebar" title="Toggle Sidebar" class="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors cursor-pointer">
          <svg class="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <rect x="3" y="3" width="18" height="18" rx="2" stroke-width="2" />
            <path stroke-linecap="round" stroke-width="2" d="M9 3v18" />
          </svg>
        </button>
        <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
        <span class="text-sm font-medium text-gray-600 dark:text-gray-300 truncate max-w-[400px]">
          {{ activeTab ? activeTab.name : 'Markfly' }}
        </span>
      </div>
      <div class="flex items-center space-x-1">
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
        @import-markdown="openFile"
        @import-url="openUrlImport"
      />

      <!-- Content area -->
      <div class="flex-1 flex flex-col overflow-hidden">
        <TabBar
          :tabs="activeTabs"
          :activePath="activePath"
          @select="selectFile"
          @close="closeTab"
        />

        <div v-if="activePath" class="app-toolbar h-10 shrink-0 flex items-center justify-end gap-1 px-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-[#181715] select-none">
          <button @click="handleTabAction(activePath, 'search')" title="Find in Document (⌘F)" aria-label="Find in Document" class="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer">
            <svg class="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5" stroke-width="2"/><path stroke-linecap="round" stroke-width="2" d="m16 16 5 5"/></svg>
          </button>
          <button @click="handleTabAction(activePath, 'zoom-out')" title="Zoom out" aria-label="Zoom out" class="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer">
            <svg class="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-width="2" d="M20 12H4"/></svg>
          </button>
          <button @click="handleTabAction(activePath, 'zoom-reset')" title="Reset zoom" class="min-w-10 px-1 text-xs text-gray-500 dark:text-gray-400 cursor-pointer">{{ Math.round(activeZoom * 100) }}%</button>
          <button @click="handleTabAction(activePath, 'zoom-in')" title="Zoom in" aria-label="Zoom in" class="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer">
            <svg class="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
          </button>
          <div class="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1"></div>
          <button @click="handleTabAction(activePath, 'source')" :title="showRaw ? 'Show Preview' : 'Show Source'" :aria-label="showRaw ? 'Show Preview' : 'Show Source'" class="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer">
            <svg v-if="!showRaw" class="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/></svg>
            <svg v-else class="w-4 h-4 text-blue-500 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a2 2 0 01.293.707V19a2 2 0 01-2-2z"/></svg>
          </button>
          <button @click="handleTabAction(activePath, 'copy')" title="Copy as Markdown" aria-label="Copy as Markdown" class="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer">
            <svg class="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="8" y="8" width="13" height="13" rx="2" stroke-width="2"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 8V5a2 2 0 00-2-2H5a2 2 0 00-2 2v9a2 2 0 002 2h3"/></svg>
          </button>
          <div class="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1"></div>
          <button @click="outlineOpen = !outlineOpen" :aria-label="outlineOpen ? 'Close outline' : 'Open outline'" :title="outlineOpen ? 'Close outline' : 'Open outline'" :class="outlineOpen ? 'bg-gray-100 dark:bg-gray-800 text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'" class="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="7" cy="7" r="3" stroke-width="2"/><path stroke-linecap="round" stroke-width="2" d="M13 7h8"/><circle cx="7" cy="17" r="3" stroke-width="2"/><path stroke-linecap="round" stroke-width="2" d="M13 17h8"/></svg>
          </button>
        </div>

        <div v-if="searchOpen && activePath" class="app-search h-12 shrink-0 flex items-center justify-end gap-2 px-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-[#181715]">
          <input
            ref="searchInput"
            v-model="searchQuery"
            class="w-64 h-8 px-2 text-sm rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#161b22] text-gray-900 dark:text-gray-100 outline-none focus:border-blue-500"
            placeholder="Find in document"
            aria-label="Find in document"
            @keydown.enter.prevent="moveSearchMatch($event.shiftKey ? -1 : 1)"
            @keydown.esc.prevent="closeSearch"
          />
          <span class="w-14 text-center text-xs text-gray-500 dark:text-gray-400 tabular-nums">{{ searchMatchCount ? searchIndex + 1 : 0 }} / {{ searchMatchCount }}</span>
          <button @click="moveSearchMatch(-1)" title="Previous match (Shift+Enter)" class="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer" :disabled="!searchMatchCount">
            <svg class="w-4 h-4 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m18 15-6-6-6 6" /></svg>
          </button>
          <button @click="moveSearchMatch(1)" title="Next match (Enter)" class="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer" :disabled="!searchMatchCount">
            <svg class="w-4 h-4 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m6 9 6 6 6-6" /></svg>
          </button>
          <button @click="closeSearch" title="Close search (Esc)" class="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer">
            <svg class="w-4 h-4 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-width="2" d="m6 6 12 12M18 6 6 18" /></svg>
          </button>
        </div>

        <!-- Empty state -->
        <div v-if="!activePath" @click="openFile" class="flex-1 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 cursor-pointer">
          <div class="w-24 h-24 mb-6 border-4 border-dashed border-gray-300 dark:border-gray-700 rounded-xl flex items-center justify-center bg-gray-50 dark:bg-[#161b22]">
            <svg class="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
          </div>
          <p class="text-sm font-medium text-gray-600 dark:text-gray-300">Drop .md here or click to open</p>
        </div>

        <!-- Preview area -->
        <div v-else class="app-document-layout flex-1 min-h-0 flex overflow-hidden">
          <div ref="documentEl" class="flex-1 min-w-0 bg-white dark:bg-[#181715] transition-colors duration-200 markdown-scroll" :data-theme="isDark ? 'dark' : 'light'">
            <div v-if="showRaw" class="h-full p-4 overflow-auto">
              <pre class="raw-markdown text-sm font-mono whitespace-pre-wrap break-all">{{ fileContents[activePath] || '' }}</pre>
            </div>
            <article
              v-else
              ref="articleEl"
              class="markdown-body"
              :style="{ fontSize: `${activeZoom * 100}%` }"
              @click="onArticleClick"
              v-html="rendered">
            </article>
          </div>
          <OutlinePanel
            v-if="outlineOpen"
            :documentTitle="activeTab?.name || ''"
            :headings="outlineHeadings"
            @close="outlineOpen = false"
            @select="jumpToHeading"
          />
        </div>
      </div>
    </main>

    <div v-if="copyStatus" role="status" class="app-toast fixed bottom-5 right-5 z-40 rounded-lg bg-gray-900 px-4 py-2 text-sm text-white shadow-lg dark:bg-gray-100 dark:text-gray-900">
      {{ copyStatus }}
    </div>

    <div v-if="urlImportOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4" @keydown.esc.stop="closeUrlImport">
      <button class="absolute inset-0 bg-black/25 backdrop-blur-sm cursor-default" aria-label="Close URL import dialog" @click="closeUrlImport"></button>
      <form
        class="app-dialog relative w-full max-w-md rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#252320] p-5 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="url-import-title"
        @submit.prevent="importFromUrl"
      >
        <h2 id="url-import-title" class="flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-gray-100">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" stroke-width="1.8"/><path stroke-linecap="round" stroke-width="1.8" d="M3 12h18M12 3a15 15 0 0 1 0 18m0-18a15 15 0 0 0 0 18"/></svg>
          Import Markdown from URL
        </h2>
        <p class="mt-2 text-sm leading-5 text-gray-500 dark:text-gray-400">Paste a public Markdown or plain-text URL. GitHub blob links are converted to raw files automatically.</p>
        <input
          ref="urlImportInput"
          v-model="urlImportValue"
          type="url"
          required
          placeholder="https://github.com/owner/repo/blob/main/README.md"
          aria-label="Markdown URL"
          class="mt-4 w-full h-11 px-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#0d1117] text-sm text-gray-900 placeholder:text-gray-500 dark:text-gray-100 dark:placeholder:text-gray-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:opacity-60"
          :disabled="urlImporting"
          @input="urlImportError = null"
        />
        <p v-if="urlImportError" role="alert" class="mt-2 text-sm text-red-600 dark:text-red-400">{{ urlImportError }}</p>
        <div class="mt-4 flex justify-end gap-2">
          <button type="button" class="h-9 px-4 rounded-lg border border-gray-200 dark:border-gray-600 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer disabled:opacity-50" :disabled="urlImporting" @click="closeUrlImport">Cancel</button>
          <button type="submit" class="h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium cursor-pointer disabled:opacity-50 disabled:cursor-wait" :disabled="urlImporting || !urlImportValue.trim()">{{ urlImporting ? 'Importing…' : 'Import' }}</button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { marked } from 'marked'
import markedKatex from 'marked-katex-extension'
import hljs from 'highlight.js/lib/core'
import bash from 'highlight.js/lib/languages/bash'
import c from 'highlight.js/lib/languages/c'
import cpp from 'highlight.js/lib/languages/cpp'
import csharp from 'highlight.js/lib/languages/csharp'
import css from 'highlight.js/lib/languages/css'
import diff from 'highlight.js/lib/languages/diff'
import go from 'highlight.js/lib/languages/go'
import java from 'highlight.js/lib/languages/java'
import javascript from 'highlight.js/lib/languages/javascript'
import json from 'highlight.js/lib/languages/json'
import markdownLanguage from 'highlight.js/lib/languages/markdown'
import php from 'highlight.js/lib/languages/php'
import python from 'highlight.js/lib/languages/python'
import ruby from 'highlight.js/lib/languages/ruby'
import rust from 'highlight.js/lib/languages/rust'
import sql from 'highlight.js/lib/languages/sql'
import swift from 'highlight.js/lib/languages/swift'
import typescript from 'highlight.js/lib/languages/typescript'
import xml from 'highlight.js/lib/languages/xml'
import yaml from 'highlight.js/lib/languages/yaml'
import DOMPurify from 'dompurify'
import 'katex/dist/katex.min.css'
import mdLightUrl from 'github-markdown-css/github-markdown-light.css?url'
import mdDarkUrl from 'github-markdown-css/github-markdown-dark.css?url'
import lightHljsUrl from 'highlight.js/styles/github.css?url'
import darkHljsUrl from 'highlight.js/styles/github-dark.css?url'
import Sidebar from './Sidebar.vue'
import TabBar from './TabBar.vue'
import OutlinePanel from './components/OutlinePanel.vue'

for (const [name, language] of Object.entries({
  bash, c, cpp, csharp, css, diff, go, java, javascript, json,
  markdown: markdownLanguage, php, python, ruby, rust, sql, swift,
  typescript, xml, yaml,
})) {
  hljs.registerLanguage(name, language)
}

const tabs = ref<TabItem[]>([])

const activeTabs = computed(() => tabs.value.filter(t => t.active !== false))
const activePath = ref<string | null>(null)
const fileContents = ref<Record<string, string>>({})
const isDark = ref(false)
const documentViews = ref<Record<string, { zoom: number; showRaw: boolean }>>({})
const activeView = computed(() => activePath.value ? documentViews.value[activePath.value] : undefined)
const activeZoom = computed(() => activeView.value?.zoom ?? 1)
const showRaw = computed(() => activeView.value?.showRaw ?? false)
const outlineOpen = ref(false)
const sidebarVisible = ref(true)
const sidebarWidth = ref(260)
const urlImporting = ref(false)
const urlImportError = ref<string | null>(null)
const urlImportOpen = ref(false)
const urlImportValue = ref('')
const urlImportInput = ref<HTMLInputElement | null>(null)
const articleEl = ref<HTMLElement | null>(null)
const documentEl = ref<HTMLElement | null>(null)
const searchInput = ref<HTMLInputElement | null>(null)
const searchOpen = ref(false)
const searchQuery = ref('')
const searchMatchCount = ref(0)
const searchIndex = ref(0)
const copyStatus = ref('')
let searchRanges: Range[] = []
let copyStatusTimer: ReturnType<typeof setTimeout> | undefined

type HighlightRegistryApi = {
  set(name: string, highlight: unknown): void
  delete(name: string): void
}
type HighlightConstructor = new (...ranges: Range[]) => unknown

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char] as string)
}

const markdownRenderer = new marked.Renderer()
let renderedHeadingIndex = 0
let mermaidSources: string[] = []
let mermaidRenderVersion = 0
let mermaidRenderQueue = Promise.resolve()
type MermaidMode = 'diagram' | 'code' | 'split'
const mermaidModes = new Map<string, MermaidMode>()
marked.use(markedKatex({ throwOnError: false }))
markdownRenderer.heading = ({ depth, text }) => {
  const id = `markfly-heading-${renderedHeadingIndex++}`
  return `<h${depth} id="${id}">${text}</h${depth}>\n`
}
markdownRenderer.code = ({ text, lang }) => {
  const language = lang?.trim().split(/\s+/)[0]?.toLowerCase()
  if (language === 'mermaid') {
    const sourceIndex = mermaidSources.push(text) - 1
    const source = escapeHtml(text)
    return `<section class="mermaid-block" data-mermaid-index="${sourceIndex}" data-mode="diagram">
      <div class="mermaid-toolbar"><span class="mermaid-label">Mermaid</span><div class="mermaid-view-options" role="group" aria-label="Mermaid view">
        <button type="button" data-mermaid-mode="diagram" aria-pressed="true">Diagram</button>
        <button type="button" data-mermaid-mode="code" aria-pressed="false">Code</button>
        <button type="button" data-mermaid-mode="split" aria-pressed="false">Diagram + Code</button>
      </div></div>
      <div class="mermaid-content"><div class="mermaid-diagram"><pre class="mermaid" data-mermaid-index="${sourceIndex}">${source}</pre></div><pre class="mermaid-code"><code>${source}</code></pre></div>
    </section>\n`
  }

  const hasLanguage = Boolean(language && hljs.getLanguage(language))
  const highlighted = hasLanguage
    ? hljs.highlight(text, { language: language as string }).value
    : hljs.highlightAuto(text).value
  const languageClass = hasLanguage ? ` class="language-${escapeHtml(language as string)}"` : ''
  return `<pre><code${languageClass}>${highlighted}</code></pre>\n`
}

const activeTab = computed(() => tabs.value.find(t => t.path === activePath.value))

const rendered = computed(() => {
  const content = activePath.value ? fileContents.value[activePath.value] || '' : ''
  renderedHeadingIndex = 0
  mermaidSources = []
  const html = marked.parse(content, {
    async: false,
    renderer: markdownRenderer,
  }) as string
  return DOMPurify.sanitize(html)
})

function applyMermaidModes(article: HTMLElement) {
  article.querySelectorAll<HTMLElement>('.mermaid-block').forEach(block => {
    const index = Number(block.dataset.mermaidIndex)
    const mode = mermaidModes.get(`${activePath.value}:${index}`) ?? 'diagram'
    block.dataset.mode = mode
    block.querySelectorAll<HTMLButtonElement>('[data-mermaid-mode]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.mermaidMode === mode))
    })
  })
}

function onArticleClick(event: MouseEvent) {
  if (!(event.target instanceof Element)) return
  const button = event.target.closest<HTMLButtonElement>('[data-mermaid-mode]')
  const block = button?.closest<HTMLElement>('.mermaid-block')
  const mode = button?.dataset.mermaidMode
  if (!block || !activePath.value || (mode !== 'diagram' && mode !== 'code' && mode !== 'split')) return
  mermaidModes.set(`${activePath.value}:${Number(block.dataset.mermaidIndex)}`, mode)
  if (articleEl.value) applyMermaidModes(articleEl.value)
}

const outlineHeadings = computed(() => {
  const content = activePath.value ? fileContents.value[activePath.value] || '' : ''
  return marked.lexer(content)
    .filter(token => token.type === 'heading')
    .map((token, index) => {
      if (token.type !== 'heading') return null
      const inlineHtml = marked.parseInline(token.text, { async: false }) as string
      const text = new DOMParser().parseFromString(DOMPurify.sanitize(inlineHtml), 'text/html').body.textContent?.trim()
      return { id: `markfly-heading-${index}`, level: token.depth, text: text || token.text }
    })
    .filter((heading): heading is { id: string; level: number; text: string } => heading !== null)
})

function clearSearchHighlights() {
  const registry = (CSS as unknown as { highlights?: HighlightRegistryApi }).highlights
  registry?.delete('markfly-search')
  registry?.delete('markfly-search-active')
  searchRanges = []
  searchMatchCount.value = 0
  searchIndex.value = 0
}

function applySearchHighlights() {
  const registry = (CSS as unknown as { highlights?: HighlightRegistryApi }).highlights
  const Highlight = (window as unknown as { Highlight?: HighlightConstructor }).Highlight
  if (!registry || !Highlight || !searchRanges.length) return

  registry.set('markfly-search', new Highlight(...searchRanges))
  registry.set('markfly-search-active', new Highlight(searchRanges[searchIndex.value]))
}

function refreshSearch() {
  clearSearchHighlights()
  const query = searchQuery.value.trim()
  const root = documentEl.value
  if (!query || !root) return

  const normalizedQuery = query.toLocaleLowerCase()
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let node = walker.nextNode()
  while (node) {
    const text = node.textContent || ''
    const normalizedText = text.toLocaleLowerCase()
    let offset = 0
    while (offset < normalizedText.length) {
      const start = normalizedText.indexOf(normalizedQuery, offset)
      if (start === -1) break
      const range = document.createRange()
      range.setStart(node, start)
      range.setEnd(node, start + query.length)
      searchRanges.push(range)
      offset = start + query.length
    }
    node = walker.nextNode()
  }

  searchMatchCount.value = searchRanges.length
  applySearchHighlights()
  if (searchRanges.length) scrollToSearchMatch()
}

function scrollToSearchMatch() {
  const range = searchRanges[searchIndex.value]
  const target = range?.startContainer.parentElement
  target?.scrollIntoView({ block: 'center', behavior: 'smooth' })
}

function moveSearchMatch(direction: -1 | 1) {
  if (!searchRanges.length) return
  searchIndex.value = (searchIndex.value + direction + searchRanges.length) % searchRanges.length
  applySearchHighlights()
  scrollToSearchMatch()
}

async function openSearch() {
  searchOpen.value = true
  await nextTick()
  searchInput.value?.focus()
  searchInput.value?.select()
}

function ensureDocumentView(path: string) {
  if (!documentViews.value[path]) documentViews.value[path] = { zoom: 1, showRaw: false }
}

async function jumpToHeading(id: string) {
  if (showRaw.value && activeView.value) activeView.value.showRaw = false
  await nextTick()
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

async function handleTabAction(path: string, action: 'search' | 'zoom-out' | 'zoom-reset' | 'zoom-in' | 'source' | 'copy') {
  await selectFile(path)
  ensureDocumentView(path)
  const view = documentViews.value[path]
  if (action === 'search') {
    await openSearch()
  } else if (action === 'zoom-out') {
    view.zoom = Math.max(0.5, view.zoom - 0.1)
  } else if (action === 'zoom-reset') {
    view.zoom = 1
  } else if (action === 'zoom-in') {
    view.zoom = Math.min(3, view.zoom + 0.1)
  } else if (action === 'source') {
    view.showRaw = !view.showRaw
  } else {
    try {
      await window.electronAPI.copyText(fileContents.value[path] ?? '')
      copyStatus.value = 'Markdown copied'
    } catch (error) {
      console.error('Copy Markdown error:', error)
      copyStatus.value = 'Copy failed'
    }
    clearTimeout(copyStatusTimer)
    copyStatusTimer = setTimeout(() => { copyStatus.value = '' }, 1800)
  }
  saveState()
}

function closeSearch() {
  searchOpen.value = false
  searchQuery.value = ''
  clearSearchHighlights()
}

function handleGlobalKeydown(event: KeyboardEvent) {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'f' && activePath.value) {
    event.preventDefault()
    openSearch()
  } else if (event.key === 'Escape' && searchOpen.value) {
    event.preventDefault()
    closeSearch()
  }
}

watch([searchQuery, rendered, activePath, showRaw, searchOpen], async () => {
  await nextTick()
  refreshSearch()
}, { flush: 'post' })

watch([rendered, isDark, showRaw], async ([html, dark, raw], [previousHtml, previousDark]) => {
  const version = ++mermaidRenderVersion
  const sources = [...mermaidSources]
  await nextTick()
  mermaidRenderQueue = mermaidRenderQueue.then(async () => {
    if (version !== mermaidRenderVersion) return
    const article = articleEl.value
    if (raw || !article) return

    if (dark !== previousDark && html === previousHtml) {
      const scrollTop = documentEl.value?.scrollTop ?? 0
      article.innerHTML = html
      documentEl.value?.scrollTo({ top: scrollTop })
    }

    applyMermaidModes(article)
    const nodes = article.querySelectorAll<HTMLElement>('.mermaid-block pre.mermaid')
    if (!nodes.length) return
    const { default: mermaid } = await import('mermaid')
    if (version !== mermaidRenderVersion) return
    mermaid.initialize({
      startOnLoad: false,
      theme: 'base',
      securityLevel: 'strict',
      themeVariables: dark ? {
        background: '#252320', primaryColor: '#3a2922', primaryTextColor: '#faf9f5',
        primaryBorderColor: '#d68a6d', lineColor: '#c2bcb2', textColor: '#ded9cf',
        secondaryColor: '#393631', tertiaryColor: '#252320',
        actorBkg: '#3a2922', actorBorder: '#d68a6d', actorTextColor: '#faf9f5',
        signalColor: '#c2bcb2', signalTextColor: '#ded9cf',
        labelBoxBkgColor: '#252320', labelTextColor: '#ded9cf',
      } : {
        background: '#f5f0e8', primaryColor: '#f4e5dc', primaryTextColor: '#141413',
        primaryBorderColor: '#cc785c', lineColor: '#6c6a64', textColor: '#3d3d3a',
        secondaryColor: '#efe9de', tertiaryColor: '#faf9f5',
        actorBkg: '#f4e5dc', actorBorder: '#cc785c', actorTextColor: '#141413',
        signalColor: '#6c6a64', signalTextColor: '#3d3d3a',
        labelBoxBkgColor: '#faf9f5', labelTextColor: '#3d3d3a',
      },
    })
    for (const node of nodes) {
      if (version !== mermaidRenderVersion) return
      const index = Number(node.dataset.mermaidIndex)
      const source = sources[index]
      if (source === undefined) continue
      node.textContent = source
      try {
        await mermaid.run({ nodes: [node] })
      } catch (error) {
        console.error('Mermaid render error:', error)
        const block = node.closest<HTMLElement>('.mermaid-block')
        if (block) {
          block.dataset.mode = 'code'
          block.querySelectorAll<HTMLButtonElement>('[data-mermaid-mode]').forEach(button => {
            button.setAttribute('aria-pressed', String(button.dataset.mermaidMode === 'code'))
          })
        }
      }
    }
  }).catch(error => {
    console.error('Mermaid render error:', error)
  })
}, { flush: 'post' })

async function saveState() {
  await window.electronAPI.savePref({
    dark: isDark.value,
    sidebarVisible: sidebarVisible.value,
    sidebarWidth: sidebarWidth.value,
    tabs: tabs.value.map(t => ({ path: t.path, active: t.active })),
    activePath: activePath.value,
    views: Object.fromEntries(Object.entries(documentViews.value).map(([path, view]) => [path, { ...view }])),
  })
}

function toggleSidebar() {
  sidebarVisible.value = !sidebarVisible.value
  saveState()
}

async function openUrlImport() {
  urlImportOpen.value = true
  urlImportError.value = null
  await nextTick()
  urlImportInput.value?.focus()
}

function closeUrlImport() {
  if (urlImporting.value) return
  urlImportOpen.value = false
  urlImportError.value = null
  urlImportValue.value = ''
}

function isRemotePath(path: string) {
  return /^https?:\/\//i.test(path)
}

function getDocumentName(path: string) {
  if (isRemotePath(path)) {
    try {
      const url = new URL(path)
      const filename = url.pathname.split('/').filter(Boolean).pop()
      return filename ? decodeURIComponent(filename) : url.hostname
    } catch { return path }
  }
  return path.split('/').pop() || 'Unknown'
}

async function selectFile(path: string, content?: string) {
  ensureDocumentView(path)
  const existing = tabs.value.find(t => t.path === path)
  if (existing) {
    existing.active = true
    activePath.value = path
    if (content !== undefined) fileContents.value[path] = content
    if (!Object.hasOwn(fileContents.value, path)) {
      await loadFileContent(path)
    }
    saveState()
    return
  }
  const name = getDocumentName(path)
  tabs.value.push({ path, name, active: true })
  activePath.value = path
  if (content !== undefined) fileContents.value[path] = content
  else await loadFileContent(path)
  saveState()
}

async function removeTab(path: string) {
  const idx = tabs.value.findIndex(t => t.path === path)
  if (idx === -1) return
  tabs.value.splice(idx, 1)
  delete fileContents.value[path]
  delete documentViews.value[path]
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
    if (isRemotePath(filePath)) {
      const result = await window.electronAPI.fetchMarkdownUrl(filePath)
      fileContents.value[filePath] = result.content
      return
    }

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

async function importFromUrl() {
  const url = urlImportValue.value.trim()
  if (!url) return
  urlImporting.value = true
  urlImportError.value = null
  try {
    const result = await window.electronAPI.fetchMarkdownUrl(url)
    await selectFile(result.url, result.content)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to import this URL.'
    urlImportError.value = message
      .replace(/^Error invoking remote method 'fetch-markdown-url':\s*/, '')
      .replace(/^Error:\s*/, '')
  } finally {
    urlImporting.value = false
  }
  if (!urlImportError.value) closeUrlImport()
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
    const filePath = window.electronAPI.getPathForFile(file)
    if (filePath) await selectFile(filePath)
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
  window.addEventListener('keydown', handleGlobalKeydown)
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
      if (typeof path !== 'string' || path.startsWith('file://')) continue
      const active = typeof p === 'string' ? true : p.active !== false
      const name = getDocumentName(path)
      tabs.value.push({ path, name, active })
      const savedViews = pref.views as Record<string, { zoom?: unknown; showRaw?: unknown }> | undefined
      const savedView = savedViews?.[path]
      documentViews.value[path] = {
        zoom: typeof savedView?.zoom === 'number' ? savedView.zoom : (typeof pref.zoom === 'number' ? pref.zoom : 1),
        showRaw: typeof savedView?.showRaw === 'boolean' ? savedView.showRaw : (typeof pref.showRaw === 'boolean' ? pref.showRaw : false),
      }
      if (active) {
        try {
          await loadFileContent(path)
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

  await window.electronAPI.rendererReady()

  window.addEventListener('beforeunload', () => {
    saveState()
  })
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
  clearSearchHighlights()
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
