<template>
  <section
    v-if="showUpdate"
    class="shrink-0 border-t border-gray-200 dark:border-gray-700 px-2 py-2 space-y-1.5"
    aria-label="Update Center"
    aria-live="polite"
  >
    <div class="flex min-w-0 items-center justify-between gap-1.5">
      <span class="inline-flex min-w-0 items-center gap-1.5 rounded-full bg-blue-700 px-2.5 py-1 text-[11px] font-semibold text-white" :title="`Update available: ${state.latestVersion}`">
        <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-white"></span>
        <span class="truncate">Update · {{ state.latestVersion }}</span>
      </span>
      <button
        class="shrink-0 rounded-full px-2 py-1 text-[10px] font-medium text-blue-700 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-gray-800 cursor-pointer"
        type="button"
        @click="$emit('release-info')"
      >Release Info</button>
    </div>

    <template v-if="state.status === 'available'">
      <button class="w-full rounded-full border border-blue-700 px-2.5 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-gray-800 cursor-pointer" type="button" @click="$emit('download')">
        Download Update
      </button>
    </template>

    <template v-else-if="state.status === 'downloading'">
      <div class="flex justify-between gap-2 text-[10px] text-gray-600 dark:text-gray-300">
        <span>Downloading…</span>
        <span class="tabular-nums">{{ formatBytes(state.bytesReceived) }}<template v-if="state.totalBytes"> / {{ formatBytes(state.totalBytes) }}</template></span>
      </div>
      <div class="h-1 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700" role="progressbar" :aria-valuenow="progressPercent ?? undefined" :aria-valuemin="0" :aria-valuemax="100" :aria-label="progressPercent === null ? 'Downloading update' : `Downloading update ${progressPercent}%`">
        <div class="h-full rounded-full bg-blue-600 transition-[width] duration-150" :class="progressPercent === null ? 'w-1/3 animate-pulse' : ''" :style="progressPercent === null ? undefined : { width: `${progressPercent}%` }"></div>
      </div>
    </template>

    <template v-else-if="state.status === 'ready'">
      <div class="flex items-center justify-between gap-2">
        <span class="text-[10px] text-gray-600 dark:text-gray-300">Installer ready</span>
        <button class="rounded-full bg-blue-700 px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-blue-800 cursor-pointer" type="button" @click="$emit('open-installer')">
          Open Installer
        </button>
      </div>
      <p class="text-[10px] leading-4 text-gray-500 dark:text-gray-400">Install in macOS, then reopen Markfly.</p>
    </template>

    <template v-else-if="state.status === 'opening'">
      <p class="text-[10px] leading-4 text-gray-500 dark:text-gray-400">{{ state.error }}</p>
    </template>

    <template v-else-if="state.status === 'error'">
      <p class="text-[10px] leading-4 text-red-700 dark:text-red-300" role="alert">{{ state.error || 'Update failed.' }}</p>
      <button class="text-[10px] text-blue-700 dark:text-blue-300 hover:underline cursor-pointer" type="button" @click="$emit('check')">Try Again</button>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ state: UpdateState }>()
defineEmits<{
  check: []
  download: []
  'open-installer': []
  'release-info': []
}>()

const showUpdate = computed(() => props.state.releaseInfoAvailable && Boolean(props.state.latestVersion))
const progressPercent = computed(() => {
  if (!props.state.totalBytes || props.state.totalBytes <= 0) return null
  return Math.min(100, Math.floor(props.state.bytesReceived / props.state.totalBytes * 100))
})

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(0, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
</script>
