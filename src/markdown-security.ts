export const MAX_MERMAID_DIAGRAMS = 24
export const MAX_MERMAID_SOURCE_BYTES = 100 * 1024

export function escapeRawHtml(value: string) {
  return value.replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char] as string)
}

export function isSafeImageHref(value: string) {
  return /^data:image\/(?:png|gif|jpe?g|webp|avif);base64,[a-z0-9+/=\s]+$/i.test(value)
}

export function canRenderMermaid(index: number, source: string) {
  return index < MAX_MERMAID_DIAGRAMS && new TextEncoder().encode(source).byteLength <= MAX_MERMAID_SOURCE_BYTES
}
