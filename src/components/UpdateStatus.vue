<template>
  <section class="border-t border-gray-200 dark:border-gray-700 px-3 py-3 space-y-2" aria-label="Update Center" aria-live="polite">
    <div class="flex items-center justify-between gap-2">
      <p class="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Update Center</p>
      <button
        v-if="state.releaseInfoAvailable"
        class="text-[11px] text-blue-700 dark:text-blue-300 hover:underline cursor-pointer"
        type="button"
        @click="$emit('release-info')"
      >Release Info</button>
    </div>

    <button
      v-if="state.status === 'idle' || state.status === 'current'"
      class="w-full rounded-full bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-60 cursor-pointer disabled:cursor-wait"
      type="button"
      @click="$emit('check')"
    >
      {{ state.status === 'current' ? 'No Updates Available' : 'Check for Updates' }}
    </button>

    <div v-else-if="state.status === 'checking'" class="rounded-full bg-blue-700 px-3 py-2 text-center text-xs font-semibold text-white">
      Checking for Updates…
    </div>

    <template v-else-if="state.status === 'available'">
      <p class="text-xs text-gray-700 dark:text-gray-200">Update available: <strong>{{ state.latestVersion }}</strong></p>
      <button class="w-full rounded-full bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800 cursor-pointer" type="button" @click="$emit('download')">
        Download Update
      </button>
    </template>

    <template v-else-if="state.status === 'downloading'">
      <div class="flex justify-between gap-2 text-xs text-gray-700 dark:text-gray-200">
        <span>Downloading {{ state.latestVersion }}</span>
        <span class="tabular-nums">{{ formatBytes(state.bytesReceived) }}<template v-if="state.totalBytes"> / {{ formatBytes(state.totalBytes) }}</template></span>
      </div>
      <div class="h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700" role="progressbar" :aria-valuenow="progressPercent ?? undefined" :aria-valuemin="0" :aria-valuemax="100" :aria-label="progressPercent === null ? 'Downloading update' : `Downloading update ${progressPercent}%`">
        <div class="h-full rounded-full bg-blue-600 transition-[width] duration-150" :class="progressPercent === null ? 'w-1/3 animate-pulse' : ''" :style="progressPercent === null ? undefined : { width: `${progressPercent}%` }"></div>
      </div>
    </template>

    <template v-else-if="state.status === 'ready'">
      <p class="text-xs font-medium text-gray-700 dark:text-gray-200">Installer Ready</p>
      <p class="text-[11px] leading-4 text-gray-500 dark:text-gray-400">Finish installation in macOS Installer, then reopen Markfly.</p>
      <button class="w-full rounded-full bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800 cursor-pointer" type="button" @click="$emit('open-installer')">
        Open Installer
      </button>
    </template>

    <template v-else-if="state.status === 'opening'">
      <p class="text-xs font-medium text-gray-700 dark:text-gray-200">Installer opened</p>
      <p class="text-[11px] leading-4 text-gray-500 dark:text-gray-400">{{ state.error }}</p>
    </template>

    <template v-else-if="state.status === 'error'">
      <p class="text-[11px] leading-4 text-red-700 dark:text-red-300" role="alert">{{ state.error || 'Update check failed.' }}</p>
      <button class="w-full rounded-full border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800 cursor-pointer" type="button" @click="$emit('check')">
        Try Again
      </button>
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

const progressPercent = computed(() => {
  if (!props.state.totalBytes || props.state.totalBytes <= 0) return null
  return Math.min(100, Math.floor(props.state.bytesReceived / props.state.totalBytes * 100))
})

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(0, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
</script>
