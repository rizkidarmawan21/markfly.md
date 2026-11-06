export function preparePDFExport(article: HTMLElement): string {
  const document = article.cloneNode(true) as HTMLElement
  document.querySelectorAll('.mermaid-toolbar, .katex-mathml, [data-table-editor-control]').forEach(control => control.remove())
  document.querySelectorAll('.mermaid-block').forEach(block => {
    const diagram = block.querySelector('.mermaid-diagram')
    const code = block.querySelector('.mermaid-code')
    if (diagram?.querySelector('svg')) {
      code?.remove()
      block.setAttribute('data-mode', 'diagram')
    } else {
      diagram?.remove()
      block.setAttribute('data-mode', 'code')
    }
  })
  return document.innerHTML
}
