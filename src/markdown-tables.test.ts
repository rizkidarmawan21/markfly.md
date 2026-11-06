import assert from 'node:assert/strict'
import test from 'node:test'
import { marked } from 'marked'
import { findEditableTables, replaceTable } from './markdown-tables.ts'

const table = '| Name | Value |\n| :--- | ---: |\n| item | 12 |'
const tablesIn = (source: string) => [...findEditableTables(source, marked.lexer(source)).values()]

test('replaces only the chosen duplicate table and ignores fenced copies', () => {
  const fenced = `\`\`\`markdown\n${table}\n\`\`\``
  const prefix = `${fenced}\n\n${table}\n\n`
  const suffix = '\n\n<!-- after -->\n'
  const source = `${prefix}${table}${suffix}`.replaceAll('\n', '\r\n')
  const found = tablesIn(source)
  assert.equal(found.length, 2)

  const chosen = found[1]
  const data = { ...chosen.data, header: ['Label', 'Value'] }
  const result = replaceTable(source, chosen, data)
  assert.equal(result, `${prefix}${table.replace('Name', 'Label')}${suffix}`.replaceAll('\n', '\r\n'))
})

test('preserves list and quote markers around nested tables after adding a row', () => {
  const prefix = '> - ' + table.replaceAll('\n', '\n>   ')
  const suffix = '\n> - sibling\n\nOutside\n'
  const source = prefix + suffix
  const [found] = tablesIn(source)
  assert.ok(found)

  const rows = [...found.data.rows, { cells: ['new', '24'], overflow: [] }]
  const result = replaceTable(source, found, { ...found.data, rows })
  assert.equal(result, `${prefix}\n>   | new | 24 |${suffix}`)
})

test('round-trips formatted cells, pipe escapes, missing cells, and hidden overflow cells', () => {
  const source = '| A | B |\n| --- | :---: |\n| **a\\|b** | `x\\|y` | extra\\|value |\n| alone |\n'
  const [found] = tablesIn(source)
  assert.deepEqual(found.data.rows.map(row => row.cells), [['**a|b**', '`x|y`'], ['alone', '']])

  const result = replaceTable(source, found, { ...found.data, header: ['left | right', 'B'] })
  assert.ok(result)
  assert.match(result, /extra\\\|value/)
  const [updated] = tablesIn(result)
  assert.deepEqual(updated.data.header, ['left | right', 'B'])
  assert.deepEqual(updated.data.rows, found.data.rows)
  assert.deepEqual(updated.data.align, found.data.align)
})

test('finds a table after repeated reference definitions and a task-list table', () => {
  const nested = '- [x] task\n\n  ' + table.replaceAll('\n', '\n  ')
  const source = `[a]: /a\n[a]: /duplicate\n\n${nested}\n\n${table}`
  const found = tablesIn(source)
  assert.equal(found.length, 2)

  const result = replaceTable(source, found[0], { ...found[0].data, header: ['Task', 'Value'] })
  assert.equal(result, source.replace('Name', 'Task'))
})

test('preserves mixed line endings and blank source below the last row', () => {
  const source = '| Name | Value |\r\n| :--- | ---: |\n| item | 12 |\r\n   '
  const [found] = tablesIn(source)
  assert.ok(found)

  const result = replaceTable(source, found, { ...found.data, header: ['Label', 'Value'] })
  assert.equal(result, source.replace('Name', 'Label'))
})

test('keeps whitespace rows that Marked renders as empty cells', () => {
  const source = `${table}\n \t\n\nAfter`
  const [found] = tablesIn(source)
  assert.ok(found)
  assert.deepEqual(found.data.rows[1].cells, ['', ''])

  const result = replaceTable(source, found, { ...found.data, header: ['Label', 'Value'] })
  assert.equal(result, `${table.replace('Name', 'Label')}\n|  |  |\n\nAfter`)
})

test('accepts a one-column table with alignment and no pipes', () => {
  const source = 'Name\n:---\nitem'
  const [found] = tablesIn(source)
  assert.deepEqual(found.data.align, ['left'])
  assert.equal(replaceTable(source, found, { ...found.data, header: ['Label'] }), '| Label |\n| :--- |\n| item |')
})

test('rejects stale source and malformed drafts before replacing text', () => {
  const [found] = tablesIn(table)
  assert.equal(replaceTable(table.replace('item', 'external'), found, found.data), null)
  assert.equal(replaceTable(table, found, { ...found.data, header: [] }), null)
  assert.equal(replaceTable(table, found, { ...found.data, header: ['line\nbreak', 'B'] }), null)
})

test('rejects a pipe escape that would change inline code when saved', () => {
  const [found] = tablesIn(table)
  const row = { ...found.data.rows[0], cells: [String.raw`a\|b`, '12'] }
  assert.ok(replaceTable(table, found, { ...found.data, rows: [row] }))
  const code = { ...row, cells: ['`' + row.cells[0] + '`', '12'] }
  assert.equal(replaceTable(table, found, { ...found.data, rows: [code] }), null)
})
