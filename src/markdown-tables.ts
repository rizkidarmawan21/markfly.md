import { marked, type Token, type Tokens } from 'marked'

export type TableAlignment = 'left' | 'center' | 'right' | null

export interface TableRow {
  cells: string[]
  overflow: string[]
}

export interface TableData {
  header: string[]
  align: TableAlignment[]
  rows: TableRow[]
}

export interface EditableTable {
  start: number
  end: number
  original: string
  continuation: string
  lineEndings: string[]
  data: TableData
}

interface SourceLine {
  start: number
  text: string
  ending: string
}

function sourceLines(source: string): SourceLine[] {
  const lines: SourceLine[] = []
  let start = 0
  for (const match of source.matchAll(/\r\n?|\n/g)) {
    lines.push({ start, text: source.slice(start, match.index), ending: match[0] })
    start = match.index + match[0].length
  }
  lines.push({ start, text: source.slice(start), ending: '' })
  return lines
}

function overflowCells(line: string, columns: number) {
  const cells = []
  let start = 0
  let backslashes = 0
  for (let index = 0; index < line.length; index++) {
    const character = line[index]
    if (character === '|' && backslashes % 2 === 0) {
      cells.push(line.slice(start, index).trim())
      start = index + 1
    }
    backslashes = character === '\\' ? backslashes + 1 : 0
  }
  cells.push(line.slice(start).trim())
  if (!cells[0]) cells.shift()
  if (!cells.at(-1)) cells.pop()
  return cells.slice(columns)
}

function taskText(item: Tokens.ListItem) {
  // Marked strips task markers from item.text and emits them as checkbox tokens.
  const marker = item.checked === undefined ? null : item.raw.match(/\[[ xX]\]/)?.[0]
  return marker ? `${marker} ${item.text}` : item.text
}

export function findEditableTables(source: string, tokens: Token[]) {
  const physicalLines = sourceLines(source)
  const tables = new Map<Tokens.Table, EditableTable>()

  function addTable(token: Tokens.Table, firstLine: number) {
    const rowCount = token.rows.length + 2
    const tokenLines = token.raw.replace(/\n+$/, '').split('\n')
    const rawLines = tokenLines.slice(0, rowCount)
    const lines = physicalLines.slice(firstLine, firstLine + rawLines.length)
    if (lines.length !== rowCount || tokenLines.slice(rowCount).some(line => line.trim())) return

    const prefixes = rawLines.map((line, index) => {
      const logical = line.trim()
      const physical = lines[index].text.trimEnd()
      if (!logical && index >= 2) return ''
      return physical.endsWith(logical) ? physical.slice(0, -logical.length) : null
    })
    if (prefixes.some(prefix => prefix === null)) return

    const start = lines[0].start + prefixes[0]!.length
    const last = lines[lines.length - 1]
    const end = last.start + last.text.length
    tables.set(token, {
      start,
      end,
      original: source.slice(start, end),
      continuation: prefixes[1]!,
      lineEndings: lines.map(line => line.ending),
      data: {
        header: token.header.map(cell => cell.text),
        align: token.align,
        rows: token.rows.map((row, index) => ({
          cells: row.map(cell => cell.text),
          // GFM ignores excess cells. Keep their source attached to the row.
          overflow: overflowCells(rawLines[index + 2], token.header.length),
        })),
      },
    })
  }

  function walk(blocks: (Token | Tokens.ListItem)[], logicalSource: string, firstLine: number) {
    let cursor = 0
    let line = firstLine
    for (const token of blocks) {
      const start = logicalSource.indexOf(token.raw, cursor)
      if (start < 0) return
      const gap = logicalSource.slice(cursor, start)
      // Duplicate link definitions are consumed without producing tokens.
      if (gap.trim() && !marked.lexer(gap).every(token => token.type === 'def' || token.type === 'space')) return
      line += gap.split('\n').length - 1

      switch (token.type) {
        case 'table':
          addTable(token as Tokens.Table, line)
          break
        case 'blockquote':
          walk((token as Tokens.Blockquote).tokens, token.text, line)
          break
        case 'list':
          walk(token.items, token.raw, line)
          break
        case 'list_item':
          walk((token as Tokens.ListItem).tokens, taskText(token as Tokens.ListItem), line)
          break
      }

      cursor = start + token.raw.length
      line += token.raw.split('\n').length - 1
    }
  }

  walk(tokens, source.replace(/\r\n?/g, '\n'), 0)
  return tables
}

function escapeCell(text: string) {
  return text.trim().replace(/\\*\|/g, pipe => pipe.length % 2 ? `\\${pipe}` : pipe)
}

const alignmentMarkers = { left: ':---', center: ':---:', right: '---:' }

export function replaceTable(source: string, table: EditableTable, draft: TableData): string | null {
  if (source.slice(table.start, table.end) !== table.original) return null
  if (draft === table.data) return source

  const columns = draft.header.length
  const rows = [draft.header, ...draft.rows.map(row => row.cells)]
  if (!columns || draft.align.length !== columns || rows.some(row => row.length !== columns)) return null
  if (rows.some(row => row.some(cell => /[\r\n]/.test(cell)))) return null

  const formatRow = (cells: string[]) => `| ${cells.join(' | ')} |`
  const lines = [
    formatRow(draft.header.map(escapeCell)),
    formatRow(draft.align.map(align => align ? alignmentMarkers[align] : '---')),
    ...draft.rows.map(row => formatRow([...row.cells.map(escapeCell), ...row.overflow])),
  ]
  const replacement = lines[0] + lines.slice(1).map((line, index) => {
    const ending = table.lineEndings[index] || table.lineEndings[0]
    return ending + table.continuation + line
  }).join('')
  const updated = source.slice(0, table.start) + replacement + source.slice(table.end)

  const parsed = findEditableTables(updated, marked.lexer(updated))
  const verified = [...parsed.values()].find(candidate => candidate.start === table.start)
  if (!verified || verified.end !== table.start + replacement.length
    || verified.data.header.length !== columns || verified.data.rows.length !== draft.rows.length) return null

  const actualRows = [verified.data.header, ...verified.data.rows.map(row => row.cells)]
  for (const [index, cells] of rows.entries()) {
    const actual = actualRows[index]
    const altered = cells.some((cell, column) => {
      const expected = cell.trim()
      return expected !== actual[column]
        && marked.parseInline(expected, { async: false }) !== marked.parseInline(actual[column], { async: false })
    })
    if (altered) return null
  }
  return updated
}
