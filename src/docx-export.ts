const PNG_PREFIX = 'data:image/png;base64,'
const MAX_IMAGE_PAYLOAD = 16 * 1024 * 1024

async function diagramName(source: string) {
  const bytes = new TextEncoder().encode(source.replace(/^\n+|\n+$/g, ''))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  const hex = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
  return `mermaid-${hex}.png`
}

async function rasterizeDiagram(original: SVGSVGElement, background: string) {
  const { width, height } = original.viewBox.baseVal
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null

  const svg = original.cloneNode(true) as SVGSVGElement
  svg.setAttribute('width', String(width))
  svg.setAttribute('height', String(height))
  svg.removeAttribute('style')
  const source = new XMLSerializer().serializeToString(svg)
  const image = new Image()
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`
  await image.decode()

  const scale = Math.min(2, 1800 / Math.max(width, height))
  const canvas = original.ownerDocument.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width * scale))
  canvas.height = Math.max(1, Math.round(height * scale))
  const context = canvas.getContext('2d')
  if (!context) return null
  context.fillStyle = background
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  const uri = canvas.toDataURL('image/png')
  return uri.startsWith(PNG_PREFIX) ? uri.slice(PNG_PREFIX.length) : null
}

export async function prepareWordExport(markdown: string, article: HTMLElement) {
  const images: Record<string, string> = {}
  let payloadSize = 0
  const diagrams: { source: string; svg: SVGSVGElement; background: string }[] = []
  for (const block of article.querySelectorAll('.mermaid-block')) {
    const source = block.querySelector('.mermaid-code code')?.textContent
    const diagram = block.querySelector('.mermaid-diagram')
    const svg = diagram?.querySelector<SVGSVGElement>('svg')
    if (!source || !diagram || !svg || svg.querySelector('.error-icon')) continue
    diagrams.push({ source, svg, background: getComputedStyle(diagram).backgroundColor })
  }

  await article.ownerDocument.fonts.ready
  for (const { source, svg, background } of diagrams) {
    try {
      const name = await diagramName(source)
      if (name in images) continue
      const png = await rasterizeDiagram(svg, background)
      if (png && payloadSize + png.length <= MAX_IMAGE_PAYLOAD) {
        images[name] = png
        payloadSize += png.length
      }
    } catch {
      // Keep this diagram's code block when WebKit cannot rasterize it.
    }
  }
  return { markdown, images }
}
