<template>
  <dialog
    ref="dialog"
    aria-labelledby="table-editor-title"
    aria-describedby="table-editor-help"
    class="app-dialog m-auto w-[calc(100%-2rem)] max-w-5xl max-h-[calc(100%-2rem)] overflow-auto rounded-xl border border-gray-300 bg-white text-gray-900 shadow-xl backdrop:bg-black/40 dark:border-gray-700 dark:bg-[#252320] dark:text-gray-100"
    @cancel.prevent="cancel"
    @keydown="onKeydown"
  >
    <form class="flex flex-col gap-4 p-4 sm:p-5" :aria-busy="saving" @submit.prevent="save">
      <header>
        <h2 id="table-editor-title" class="text-base font-semibold">Edit table</h2>
        <p id="table-editor-help" class="mt-1 text-sm text-gray-600 dark:text-gray-300">Cells accept inline Markdown. Use Tab to move between cells.</p>
      </header>

      <fieldset :disabled="saving" class="flex min-w-0 flex-wrap gap-x-4 gap-y-2">
        <div role="group" aria-label="Rows" class="flex flex-wrap items-center gap-1">
          <button type="button" :class="actionClass" @click="addRow">Add row</button>
          <button type="button" :class="actionClass" aria-label="Move row up" :disabled="selectedRow <= 1" @click="moveRow(-1)">↑</button>
          <button type="button" :class="actionClass" aria-label="Move row down" :disabled="selectedRow === 0 || selectedRow >= draft.rows.length" @click="moveRow(1)">↓</button>
          <button type="button" :class="actionClass" aria-label="Delete row" :disabled="selectedRow === 0" @click="deleteRow">Delete row</button>
        </div>
        <div role="group" aria-label="Columns" class="flex flex-wrap items-center gap-1">
          <button type="button" :class="actionClass" @click="addColumn">Add column</button>
          <button type="button" :class="actionClass" aria-label="Move column left" :disabled="selectedColumn === 0" @click="moveColumn(-1)">←</button>
          <button type="button" :class="actionClass" aria-label="Move column right" :disabled="selectedColumn >= draft.header.length - 1" @click="moveColumn(1)">→</button>
          <button type="button" :class="actionClass" :disabled="draft.header.length === 1" @click="deleteColumn">Delete column</button>
          <select :class="actionClass" aria-label="Column alignment" :value="draft.align[selectedColumn] ?? ''" @change="setAlignment">
            <option value="">Default alignment</option>
            <option value="left">Align left</option>
            <option value="center">Align center</option>
            <option value="right">Align right</option>
          </select>
        </div>
      </fieldset>

      <div class="max-h-[50vh] overflow-auto rounded-lg border border-gray-300 dark:border-gray-700">
        <table class="w-full border-separate border-spacing-0 text-sm">
          <thead class="bg-gray-100 dark:bg-[#302d29]">
            <tr>
              <th class="w-10 px-2 font-medium text-gray-600 dark:text-gray-300" scope="col">#</th>
              <th v-for="(cell, column) in draft.header" :key="column" scope="col" :class="[cellClass, selectedColumn === column ? 'bg-blue-50' : '']">
                <input
                  type="text"
                  :autofocus="column === 0"
                  :class="inputClass"
                  :data-table-cell="`0-${column}`"
                  :aria-label="`Header, column ${column + 1}`"
                  :style="{ textAlign: draft.align[column] ?? 'left' }"
                  :value="cell"
                  :disabled="saving"
                  @focus="selectCell(0, column)"
                  @input="editCell(0, column, $event)"
                />
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, index) in draft.rows" :key="index" class="odd:bg-white even:bg-gray-50 dark:odd:bg-[#252320] dark:even:bg-[#2a2825]">
              <th scope="row" class="border-t border-gray-300 px-2 font-normal text-gray-600 dark:border-gray-700 dark:text-gray-300" :class="selectedRow === index + 1 ? 'bg-blue-50' : ''">{{ index + 1 }}</th>
              <td v-for="(cell, column) in row.cells" :key="column" :class="[cellClass, 'border-t']">
                <input
                  type="text"
                  :class="inputClass"
                  :data-table-cell="`${index + 1}-${column}`"
                  :aria-label="`Row ${index + 1}, column ${column + 1}`"
                  :style="{ textAlign: draft.align[column] ?? 'left' }"
                  :value="cell"
                  :disabled="saving"
                  @focus="selectCell(index + 1, column)"
                  @input="editCell(index + 1, column, $event)"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p v-if="conflicted || error" class="text-sm text-red-700 dark:text-red-300" role="alert">{{ conflicted ? 'The file changed on disk. Copy any edits you want to keep, then cancel and reopen the table.' : error }}</p>

      <footer class="flex flex-wrap items-center justify-between gap-2">
        <button type="button" :class="actionClass" :disabled="!history.length || saving" @click="undo">Undo</button>
        <div class="flex gap-2">
          <button type="button" :class="actionClass" :disabled="saving" @click="cancel">Cancel</button>
          <button type="submit" class="min-h-9 rounded-md bg-blue-700 px-3 text-sm font-medium text-white hover:brightness-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:opacity-50 dark:text-[#181715]" :disabled="!canSave">{{ saving ? 'Saving…' : 'Save table' }}</button>
        </div>
      </footer>
    </form>
  </dialog>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, shallowRef } from 'vue'
import type { TableAlignment, TableData } from '../markdown-tables'

const props = defineProps<{ table: TableData; saving: boolean; conflicted: boolean; error: string }>()
const emit = defineEmits<{ save: [draft: TableData]; cancel: [] }>()

const actionClass = 'min-h-9 rounded-md border border-gray-400 bg-white px-2.5 text-sm hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:opacity-45 dark:border-gray-500 dark:bg-[#302d29] dark:hover:bg-gray-700'
const cellClass = 'min-w-36 border-l border-gray-300 p-0 dark:border-gray-700'
const inputClass = 'h-9 w-full min-w-0 bg-transparent px-2 text-current focus-visible:bg-white focus-visible:outline-2 focus-visible:outline-blue-500 dark:focus-visible:bg-[#181715]'

const dialog = ref<HTMLDialogElement | null>(null)
const draft = shallowRef(props.table)
const selectedRow = ref(0)
const selectedColumn = ref(0)
type Snapshot = { data: TableData; row: number; column: number }
const history = shallowRef<Snapshot[]>([])
let typingCell = ''

const canSave = computed(() => draft.value !== props.table && !props.saving && !props.conflicted)

onMounted(() => dialog.value?.showModal())

function cancel() {
  if (!props.saving) emit('cancel')
}

function save() {
  if (canSave.value) emit('save', draft.value)
}

function selectCell(row: number, column: number) {
  selectedRow.value = row
  selectedColumn.value = column
  typingCell = ''
}

async function focusCell(row: number, column: number) {
  selectCell(row, column)
  await nextTick()
  dialog.value?.querySelector<HTMLInputElement>(`[data-table-cell="${row}-${column}"]`)?.focus()
}

function change(data: TableData, cell = '') {
  if (!cell || cell !== typingCell) {
    history.value = [...history.value.slice(-59), { data: draft.value, row: selectedRow.value, column: selectedColumn.value }]
  }
  typingCell = cell
  draft.value = data
}

function undo() {
  if (props.saving) return
  const snapshot = history.value.at(-1)
  if (!snapshot) return
  history.value = history.value.slice(0, -1)
  draft.value = snapshot.data
  focusCell(snapshot.row, snapshot.column)
}

function onKeydown(event: KeyboardEvent) {
  if (event.isComposing) return
  if ((event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === 'z') {
    event.preventDefault()
    undo()
  }
  if (event.key === 'Enter' && event.target instanceof HTMLInputElement) event.preventDefault()
}

function editCell(row: number, column: number, event: Event) {
  const value = (event.target as HTMLInputElement).value
  const { header, rows } = draft.value
  if (row === 0) {
    change({ ...draft.value, header: spliced(header, column, 1, value) }, `${row}-${column}`)
  } else {
    const item = rows[row - 1]
    const updated = { ...item, cells: spliced(item.cells, column, 1, value) }
    change({ ...draft.value, rows: spliced(rows, row - 1, 1, updated) }, `${row}-${column}`)
  }
}

function spliced<T>(items: T[], index: number, remove: number, ...values: T[]) {
  const updated = items.slice()
  updated.splice(index, remove, ...values)
  return updated
}

function moved<T>(items: T[], from: number, to: number) {
  const updated = items.slice()
  const [item] = updated.splice(from, 1)
  updated.splice(to, 0, item)
  return updated
}

function addRow() {
  const index = selectedRow.value
  const row = { cells: draft.value.header.map(() => ''), overflow: [] }
  change({ ...draft.value, rows: spliced(draft.value.rows, index, 0, row) })
  focusCell(index + 1, selectedColumn.value)
}

function deleteRow() {
  const index = selectedRow.value
  const rows = spliced(draft.value.rows, index - 1, 1)
  change({ ...draft.value, rows })
  focusCell(Math.min(index, rows.length), selectedColumn.value)
}

function moveRow(direction: -1 | 1) {
  const index = selectedRow.value - 1
  change({ ...draft.value, rows: moved(draft.value.rows, index, index + direction) })
  focusCell(selectedRow.value + direction, selectedColumn.value)
}

function addColumn() {
  const index = selectedColumn.value + 1
  const { header, align, rows } = draft.value
  change({
    header: spliced(header, index, 0, ''),
    align: spliced(align, index, 0, null),
    rows: rows.map(row => ({ ...row, cells: spliced(row.cells, index, 0, '') })),
  })
  focusCell(selectedRow.value, index)
}

function deleteColumn() {
  const index = selectedColumn.value
  const { header, align, rows } = draft.value
  change({
    header: spliced(header, index, 1),
    align: spliced(align, index, 1),
    rows: rows.map(row => ({ ...row, cells: spliced(row.cells, index, 1) })),
  })
  focusCell(selectedRow.value, Math.min(index, draft.value.header.length - 1))
}

function moveColumn(direction: -1 | 1) {
  const index = selectedColumn.value
  const to = index + direction
  const { header, align, rows } = draft.value
  change({
    header: moved(header, index, to),
    align: moved(align, index, to),
    rows: rows.map(row => ({ ...row, cells: moved(row.cells, index, to) })),
  })
  focusCell(selectedRow.value, to)
}

function setAlignment(event: Event) {
  const value = (event.target as HTMLSelectElement).value as TableAlignment | ''
  change({ ...draft.value, align: spliced(draft.value.align, selectedColumn.value, 1, value || null) })
}
</script>

<style scoped>
input[data-table-cell]:focus-visible {
  outline-offset: -2px;
}
</style>
