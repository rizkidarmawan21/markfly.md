<template>
  <section
    v-if="showUpdate"
    class="shrink-0 border-t border-gray-200 dark:border-gray-700 px-1.5 py-1"
    aria-label="Update Center"
    aria-live="polite"
  >
    <div class="flex min-w-0 items-center justify-between gap-1.5">
      <button
        class="inline-flex min-w-0 items-center gap-0.5 rounded-full bg-[var(--mf-primary-active)] px-1.5 py-0.5 text-[9px] font-medium leading-3 text-white hover:bg-[var(--mf-primary)] dark:text-[#181715] cursor-pointer"
        type="button"
        :aria-expanded="expanded"
        :title="`Update available: ${state.latestVersion}`"
        @click="expanded = !expanded"
      >
        <span class="h-1 w-1 shrink-0 rounded-full bg-white"></span>
        <span class="truncate">Update · {{ state.latestVersion }}</span>
        <svg v-if="expanded" class="h-2.5 w-2.5 shrink-0 transition-transform rotate-180" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M5.22 7.47a.75.75 0 0 1 1.06 0L10 11.19l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 8.53a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd"/></svg>
      </button>
    </div>

    <template v-if="expanded && state.status === 'available'">
      <div class="mt-1.5 flex items-center justify-between gap-1">
        <a class="px-1 py-1 text-[10px] text-[var(--mf-primary-active)] underline-offset-2 hover:underline cursor-pointer" href="https://github.com/rizkidarmawan21/markfly.md/releases/latest" @click.prevent="$emit('release-info')">Release Info</a>
        <a class="px-1 py-1 text-[10px] font-medium text-[var(--mf-primary-active)] underline-offset-2 hover:underline cursor-pointer" href="#download-update" @click.prevent="$emit('download')">Download Update</a>
      </div>
    </template>

    <template v-else-if="expanded && state.status === 'downloading'">
      <div class="flex justify-between gap-2 text-[10px] text-gray-600 dark:text-gray-300">
        <span>Downloading…</span>
        <span class="tabular-nums">{{ formatBytes(state.bytesReceived) }}<template v-if="state.totalBytes"> / {{ formatBytes(state.totalBytes) }}</template></span>
      </div>
      <div class="h-1 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700" role="progressbar" :aria-valuenow="progressPercent ?? undefined" :aria-valuemin="0" :aria-valuemax="100" :aria-label="progressPercent === null ? 'Downloading update' : `Downloading update ${progressPercent}%`">
        <div class="h-full rounded-full bg-blue-600 transition-[width] duration-150" :class="progressPercent === null ? 'w-1/3 animate-pulse' : ''" :style="progressPercent === null ? undefined : { width: `${progressPercent}%` }"></div>
      </div>
    </template>

    <template v-else-if="expanded && state.status === 'ready'">
      <div class="flex items-center justify-between gap-2">
        <span class="text-[10px] text-gray-600 dark:text-gray-300">Installer ready</span>
        <button class="rounded-full bg-[var(--mf-primary-active)] px-2 py-0.5 text-[9px] font-medium leading-3 text-white hover:bg-[var(--mf-primary)] dark:text-[#181715] cursor-pointer" type="button" @click="$emit('open-installer')">
          Open Installer
        </button>
      </div>
      <p class="text-[10px] leading-4 text-gray-500 dark:text-gray-400">Install in macOS, then reopen Markfly.</p>
    </template>

    <template v-else-if="expanded && state.status === 'opening'">
      <p class="text-[10px] leading-4 text-gray-500 dark:text-gray-400">{{ state.error }}</p>
    </template>

    <template v-else-if="expanded && state.status === 'error'">
      <p class="text-[10px] leading-4 text-red-700 dark:text-red-300" role="alert">{{ state.error || 'Update failed.' }}</p>
      <button class="text-[10px] text-[var(--mf-primary-active)] hover:underline cursor-pointer" type="button" @click="$emit('check')">Try Again</button>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = defineProps<{ state: UpdateState }>()
const expanded = ref(false)
defineEmits<{
  check: []
  download: []
  'open-installer': []
  'release-info': []
}>()

const showUpdate = computed(() => props.state.releaseInfoAvailable && Boolean(props.state.latestVersion))
watch(() => props.state.status, status => {
  if (['downloading', 'ready', 'opening', 'error'].includes(status)) expanded.value = true
})
const progressPercent = computed(() => {
  if (!props.state.totalBytes || props.state.totalBytes <= 0) return null
  return Math.min(100, Math.floor(props.state.bytesReceived / props.state.totalBytes * 100))
})

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(0, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
</script>
