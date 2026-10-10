import test from 'node:test'
import assert from 'node:assert/strict'

import {
  MAX_MERMAID_DIAGRAMS,
  MAX_MERMAID_SOURCE_BYTES,
  canRenderMermaid,
  escapeRawHtml,
  isSafeImageHref,
} from './markdown-security.ts'

test('raw HTML is escaped instead of becoming active DOM', () => {
  assert.equal(
    escapeRawHtml('<form action="https://attacker.example"><style>body{display:none}</style></form>'),
    '&lt;form action=&quot;https://attacker.example&quot;&gt;&lt;style&gt;body{display:none}&lt;/style&gt;&lt;/form&gt;',
  )
})

test('Markdown images allow embedded data but block remote and file URLs', () => {
  assert.equal(isSafeImageHref('data:image/png;base64,iVBORw0KGgo='), true)
  assert.equal(isSafeImageHref('https://attacker.example/tracker.png'), false)
  assert.equal(isSafeImageHref('http://attacker.example/tracker.png'), false)
  assert.equal(isSafeImageHref('//attacker.example/tracker.png'), false)
  assert.equal(isSafeImageHref('file:///Users/example/secret.png'), false)
  assert.equal(isSafeImageHref('./relative-image.png'), false)
})

test('Mermaid rendering enforces diagram count and source-size boundaries', () => {
  assert.equal(canRenderMermaid(MAX_MERMAID_DIAGRAMS - 1, 'graph TD; A-->B'), true)
  assert.equal(canRenderMermaid(MAX_MERMAID_DIAGRAMS, 'graph TD; A-->B'), false)
  assert.equal(canRenderMermaid(0, 'a'.repeat(MAX_MERMAID_SOURCE_BYTES)), true)
  assert.equal(canRenderMermaid(0, 'a'.repeat(MAX_MERMAID_SOURCE_BYTES + 1)), false)
})
