<template>
  <dialog
    ref="dialog"
    aria-labelledby="table-editor-title"
    aria-describedby="table-editor-help"
    class="table-dialog m-auto w-[calc(100%-2rem)] max-w-5xl max-h-[calc(100%-2rem)] overflow-auto rounded-xl border"
    @cancel.prevent="cancel"
    @keydown="onKeydown"
  >
    <form class="flex flex-col gap-3 p-4 sm:p-5" :aria-busy="saving" @submit.prevent="save">
      <header>
        <h2 id="table-editor-title" class="text-base font-semibold">Edit table</h2>
      </header>

      <fieldset :disabled="saving" class="table-tools">
        <div v-for="group in toolGroups" :key="group.label" class="table-tool-group" role="group" :aria-label="group.label">
          <button
            v-for="tool in group.tools"
            :key="tool.label"
            type="button"
            class="table-tool"
            :aria-label="tool.label"
            :aria-pressed="tool.pressed"
            :title="tool.label"
            :disabled="tool.disabled"
            @click="tool.action"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path :d="tool.icon"/>
            </svg>
          </button>
        </div>
      </fieldset>

      <div class="table-grid max-h-[50vh] overflow-auto">
        <table
          ref="tableGrid"
          class="w-full border-separate border-spacing-0 text-sm"
          :class="{ 'table-resized': columnWidths }"
          :style="columnWidths ? { width: `${tableWidth}px` } : undefined"
        >
          <colgroup v-if="columnWidths">
            <col class="table-gutter-column"/>
            <col v-for="(width, column) in columnWidths" :key="column" :style="{ width: `${width}px` }"/>
          </colgroup>
          <thead>
            <tr class="table-column-rail">
              <td class="table-index"></td>
              <td v-for="(_, column) in draft.header" :key="column" class="table-cell">
                <div v-if="selectedColumn === column" class="table-edge-controls" data-table-edge="column" role="group" :aria-label="`Column ${column + 1} actions`">
                  <button v-for="tool in columnActions" :key="tool.label" type="button" class="table-tool table-edge-tool"
                    :aria-label="tool.label" :title="tool.label" :disabled="saving || tool.disabled" @click="tool.action">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
                      <path :d="tool.icon"/>
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
            <tr>
              <td class="table-index">
                <div v-if="selectedRow === 0" class="table-edge-controls" data-table-edge="row" role="group" aria-label="Header row actions">
                  <button type="button" class="table-tool table-edge-tool" aria-label="Add row" title="Add row" :disabled="saving" @click="addRow">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
                      <path :d="plusIcon"/>
                    </svg>
                  </button>
                </div>
              </td>
              <th v-for="(cell, column) in draft.header" :key="column" scope="col" class="table-cell">
                <input
                  type="text"
                  :autofocus="column === 0"
                  class="table-cell-input"
                  :data-table-cell="`0-${column}`"
                  :aria-label="`Header, column ${column + 1}`"
                  :style="{ textAlign: draft.align[column] ?? 'left' }"
                  :value="cell"
                  :disabled="saving"
                  @focus="selectCell(0, column)"
                  @input="editCell(0, column, $event)"
                />
                <span
                  v-if="column < draft.header.length - 1"
                  class="column-resizer"
                  :class="{ 'is-dragging': columnDrag?.column === column }"
                  role="separator"
                  aria-orientation="vertical"
                  :aria-label="`Resize column ${column + 1}`"
                  :aria-valuemin="columnWidths ? minimumColumnWidth : undefined"
                  :aria-valuemax="columnWidths ? Math.round(columnWidths[column] + columnWidths[column + 1] - minimumColumnWidth) : undefined"
                  :aria-valuenow="columnWidths ? Math.round(columnWidths[column]) : undefined"
                  :aria-disabled="saving"
                  :tabindex="saving ? -1 : 0"
                  title="Drag to resize. Use arrow keys when focused."
                  @pointerdown.prevent="startColumnResize(column, $event)"
                  @pointermove="dragColumn"
                  @pointerup="stopColumnResize"
                  @lostpointercapture="stopColumnResize"
                  @keydown.left.prevent="resizeColumnByKey(column, -8)"
                  @keydown.right.prevent="resizeColumnByKey(column, 8)"
                ></span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, index) in draft.rows" :key="index">
              <td class="table-index">
                <div v-if="selectedRow === index + 1" class="table-edge-controls" data-table-edge="row" role="group" :aria-label="`Row ${index + 1} actions`">
                  <button v-for="tool in rowActions" :key="tool.label" type="button" class="table-tool table-edge-tool"
                    :aria-label="tool.label" :title="tool.label" :disabled="saving" @click="tool.action">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
                      <path :d="tool.icon"/>
                    </svg>
                  </button>
                </div>
              </td>
              <td v-for="(cell, column) in row.cells" :key="column" class="table-cell">
                <input
                  type="text"
                  class="table-cell-input"
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
        <p id="table-editor-help" class="table-editor-help">Tab between cells · ⌥↵ row actions · ⇧⌥↵ column actions</p>
        <div class="flex gap-2">
          <button type="button" class="table-cancel" :disabled="saving" @click="cancel">Cancel</button>
          <button type="submit" class="table-save" :disabled="!canSave">{{ saving ? 'Saving…' : 'Save table' }}</button>
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

const dialog = ref<HTMLDialogElement | null>(null)
const tableGrid = ref<HTMLTableElement | null>(null)
const minimumColumnWidth = 52
const defaultColumnWidth = 144
const gutterWidth = 62
const columnWidths = shallowRef<number[] | null>(null)
const columnDrag = shallowRef<{ column: number; pointer: number; startX: number; widths: number[] } | null>(null)
const tableWidth = computed(() => (columnWidths.value ?? []).reduce((sum, width) => sum + width, gutterWidth))
const draft = shallowRef(props.table)
const selectedRow = ref(0)
const selectedColumn = ref(0)
type Snapshot = { data: TableData; row: number; column: number; widths?: number[] | null }
const history = shallowRef<Snapshot[]>([])
let typingCell = ''

const canSave = computed(() => draft.value !== props.table && !props.saving && !props.conflicted)

type TableTool = { label: string; icon: string; action: () => void; disabled?: boolean; pressed?: boolean }

const plusIcon = 'M12 5v14M5 12h14'
const minusIcon = 'M5 12h14'
const rowActions: TableTool[] = [
  { label: 'Add row', icon: plusIcon, action: addRow },
  { label: 'Delete row', icon: minusIcon, action: deleteRow },
]
const columnActions = computed<TableTool[]>(() => [
  { label: 'Add column', icon: plusIcon, action: addColumn },
  { label: 'Delete column', icon: minusIcon, action: deleteColumn, disabled: draft.value.header.length === 1 },
])

const alignmentIcons = [
  { label: 'Default alignment', value: null, icon: 'M4 6h16M4 10h16M4 14h16M4 18h16' },
  { label: 'Align left', value: 'left', icon: 'M4 6h16M4 10h10M4 14h16M4 18h10' },
  { label: 'Align center', value: 'center', icon: 'M4 6h16M7 10h10M4 14h16M7 18h10' },
  { label: 'Align right', value: 'right', icon: 'M4 6h16M10 10h10M4 14h16M10 18h10' },
] as const

const toolGroups = computed<{ label: string; tools: TableTool[] }[]>(() => [
  {
    label: 'History',
    tools: [{ label: 'Undo', icon: 'm9 14-5-5 5-5M4 9h10a5 5 0 0 1 0 10h-3', action: undo, disabled: !history.value.length }],
  },
  {
    label: 'Rows',
    tools: [
      { label: 'Move row up', icon: 'M12 19V5m-5 5 5-5 5 5', action: () => moveRow(-1), disabled: selectedRow.value <= 1 },
      { label: 'Move row down', icon: 'M12 5v14m-5-5 5 5 5-5', action: () => moveRow(1), disabled: selectedRow.value === 0 || selectedRow.value >= draft.value.rows.length },
    ],
  },
  {
    label: 'Columns',
    tools: [
      { label: 'Move column left', icon: 'M19 12H5m5-5-5 5 5 5', action: () => moveColumn(-1), disabled: selectedColumn.value === 0 },
      { label: 'Move column right', icon: 'M5 12h14m-5-5 5 5-5 5', action: () => moveColumn(1), disabled: selectedColumn.value >= draft.value.header.length - 1 },
    ],
  },
  {
    label: 'Column alignment',
    tools: alignmentIcons.map(({ label, value, icon }) => ({
      label, icon, pressed: draft.value.align[selectedColumn.value] === value,
      action: () => setAlignment(value),
    })),
  },
])

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

function measureColumnWidths() {
  return columnWidths.value ?? Array.from(
    tableGrid.value?.querySelectorAll('thead th.table-cell') ?? [],
    header => header.getBoundingClientRect().width,
  )
}

function resizeBoundary(column: number, widths: number[], delta: number) {
  const left = widths[column]
  const right = widths[column + 1]
  if (left === undefined || right === undefined) return
  const shift = Math.max(minimumColumnWidth - left, Math.min(delta, right - minimumColumnWidth))
  columnWidths.value = spliced(widths, column, 2, left + shift, right - shift)
}

function startColumnResize(column: number, event: PointerEvent) {
  if (props.saving || event.button !== 0 || columnDrag.value || !(event.currentTarget instanceof HTMLElement)) return
  event.currentTarget.setPointerCapture(event.pointerId)
  columnDrag.value = { column, pointer: event.pointerId, startX: event.clientX, widths: measureColumnWidths() }
}

function dragColumn(event: PointerEvent) {
  const drag = columnDrag.value
  if (drag?.pointer === event.pointerId) resizeBoundary(drag.column, drag.widths, event.clientX - drag.startX)
}

function stopColumnResize(event: PointerEvent) {
  if (columnDrag.value?.pointer === event.pointerId) columnDrag.value = null
}

function resizeColumnByKey(column: number, delta: number) {
  if (!props.saving && !columnDrag.value) resizeBoundary(column, measureColumnWidths(), delta)
}

function change(data: TableData, cell = '', widths?: number[] | null) {
  if (!cell || cell !== typingCell) {
    history.value = [...history.value.slice(-59), {
      data: draft.value, row: selectedRow.value, column: selectedColumn.value,
      widths: widths === undefined ? undefined : columnWidths.value,
    }]
  }
  typingCell = cell
  draft.value = data
  if (widths !== undefined) columnWidths.value = widths
}

function undo() {
  if (props.saving) return
  const snapshot = history.value.at(-1)
  if (!snapshot) return
  history.value = history.value.slice(0, -1)
  draft.value = snapshot.data
  if (snapshot.widths !== undefined) columnWidths.value = snapshot.widths
  focusCell(snapshot.row, snapshot.column)
}

function onKeydown(event: KeyboardEvent) {
  if (event.isComposing) return
  if ((event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === 'z') {
    event.preventDefault()
    undo()
  }
  if (!(event.target instanceof HTMLInputElement)) return
  if (event.key === 'Enter') {
    event.preventDefault()
    if (event.altKey) {
      const edge = event.shiftKey ? 'column' : 'row'
      dialog.value?.querySelector<HTMLButtonElement>(`[data-table-edge="${edge}"] button:not(:disabled)`)?.focus()
    }
  }
  if (event.key !== 'Tab' || !event.target.dataset.tableCell) return
  const columns = draft.value.header.length
  const next = selectedRow.value * columns + selectedColumn.value + (event.shiftKey ? -1 : 1)
  if (next < 0 || next >= columns * (draft.value.rows.length + 1)) return
  event.preventDefault()
  focusCell(Math.floor(next / columns), next % columns)
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
  }, '', columnWidths.value ? spliced(columnWidths.value, index, 0, defaultColumnWidth) : null)
  focusCell(selectedRow.value, index)
}

function deleteColumn() {
  const index = selectedColumn.value
  const { header, align, rows } = draft.value
  change({
    header: spliced(header, index, 1),
    align: spliced(align, index, 1),
    rows: rows.map(row => ({ ...row, cells: spliced(row.cells, index, 1) })),
  }, '', columnWidths.value ? spliced(columnWidths.value, index, 1) : null)
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
  }, '', columnWidths.value ? moved(columnWidths.value, index, to) : null)
  focusCell(selectedRow.value, to)
}

function setAlignment(value: TableAlignment) {
  if (draft.value.align[selectedColumn.value] === value) return
  change({ ...draft.value, align: spliced(draft.value.align, selectedColumn.value, 1, value) })
}
</script>

<style scoped>
.table-dialog {
  border-color: var(--mf-hairline);
  background: var(--mf-canvas);
  color: var(--mf-ink);
  font-family: var(--mf-font-ui);
  box-shadow: 0 20px 64px #0004;
}

.table-dialog::backdrop { background: #0005; }

.table-tools {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 0;
  align-items: center;
  min-width: 0;
  padding: 4px;
  border: 1px solid var(--mf-hairline);
  border-radius: 8px;
  background: var(--mf-surface-soft);
}

.table-tool-group {
  display: flex;
  gap: 2px;
  align-items: center;
  padding: 0 5px;
}

.table-tool-group + .table-tool-group { border-inline-start: 1px solid var(--mf-hairline); }

.table-tool {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 5px;
  color: var(--mf-muted);
  cursor: pointer;
}

.table-tool svg { width: 18px; height: 18px; }
.table-tool:disabled { opacity: .38; cursor: default; }
.table-tool:hover:not(:disabled), .table-cancel:hover { background: var(--mf-surface-card); color: var(--mf-ink); }
.table-tool[aria-pressed="true"] { background: var(--mf-primary-soft); color: var(--mf-primary-active); }

.table-grid thead { position: sticky; top: 0; z-index: 2; background: var(--mf-canvas); }
.table-index {
  position: sticky;
  left: 0;
  z-index: 1;
  width: 62px;
  min-width: 62px;
  background: var(--mf-canvas);
}

.table-column-rail { height: 27px; }

.table-edge-controls {
  display: flex;
  width: max-content;
  align-items: center;
  gap: 1px;
  padding: 1px 2px;
  border: 1px solid var(--mf-hairline);
  border-radius: 7px;
  background: var(--mf-canvas);
  box-shadow: 0 1px 2px #0002;
}

.table-edge-controls[data-table-edge="column"] {
  position: absolute;
  left: 50%;
  bottom: -4px;
  transform: translateX(-50%);
  z-index: 2;
}

.table-edge-controls[data-table-edge="row"] {
  margin-inline-start: auto;
  margin-inline-end: -1px;
  border-start-end-radius: 0;
  border-end-end-radius: 0;
}

.table-edge-tool { width: 25px; height: 24px; }
.table-edge-tool svg { width: 15px; height: 15px; }
.table-cell { min-width: 9rem; border-inline-start: 1px solid var(--mf-hairline); }
.table-cell:last-child { border-inline-end: 1px solid var(--mf-hairline); }
.table-column-rail .table-cell { position: relative; border: 0; }
.table-grid thead th.table-cell { position: relative; border-top: 1px solid var(--mf-hairline); background: var(--mf-surface-soft); }
.table-grid tbody .table-cell { border-top: 1px solid var(--mf-hairline); }
.table-grid tbody tr:last-child .table-cell,
.table-grid thead:has(+ tbody:empty) th.table-cell { border-bottom: 1px solid var(--mf-hairline); }

.table-resized { table-layout: fixed; }
.table-resized .table-cell { min-width: 0; }
.table-gutter-column { width: 62px; }

.column-resizer {
  position: absolute;
  z-index: 1;
  top: 0;
  right: -5px;
  bottom: 0;
  width: 10px;
  cursor: col-resize;
  touch-action: none;
}

.column-resizer[aria-disabled="true"] { pointer-events: none; }

.column-resizer:is(:hover, :focus-visible, .is-dragging)::after {
  position: absolute;
  inset: 0 4px;
  background: var(--mf-primary-active);
  content: '';
}

.table-cell-input {
  display: block;
  width: 100%;
  height: 37px;
  padding-inline: 9px;
  background: transparent;
  color: inherit;
}

.table-cell-input:focus { outline: 1px solid var(--mf-primary); outline-offset: -1px; }
.table-editor-help { color: var(--mf-muted); font-size: 12px; }

.table-cancel, .table-save {
  min-height: 32px;
  padding-inline: 11px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}

.table-cancel { color: var(--mf-body); }
.table-save { background: var(--mf-ink); color: var(--mf-canvas); }
.table-save:hover:not(:disabled) { opacity: .85; }
.table-cancel:disabled, .table-save:disabled { opacity: .42; cursor: default; }

:is(.table-tool, .table-cancel, .table-save):focus-visible {
  outline: 2px solid var(--mf-primary-active);
  outline-offset: -2px;
}
</style>
