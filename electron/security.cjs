const net = require('node:net')
const dns = require('node:dns').promises
const https = require('node:https')
const path = require('node:path')
const { fileURLToPath } = require('node:url')

const MAX_MARKDOWN_BYTES = 5 * 1024 * 1024
const MAX_REDIRECTS = 5
const MARKDOWN_EXTENSIONS = new Set(['.md', '.markdown', '.mdown', '.markdn'])

function parseIpv4(address) {
  if (net.isIP(address) !== 4) return null
  return address.split('.').reduce((value, part) => ((value * 256) + Number(part)) >>> 0, 0)
}

function isIpv4InRange(address, base, prefix) {
  const value = parseIpv4(address)
  const start = parseIpv4(base)
  if (value === null || start === null) return false
  const size = 2 ** (32 - prefix)
  return value >= start && value < start + size
}

function expandIpv4Tail(parts) {
  const last = parts.at(-1)
  if (!last?.includes('.')) return parts
  const value = parseIpv4(last)
  if (value === null) return parts
  return [...parts.slice(0, -1), ((value >>> 16) & 0xffff).toString(16), (value & 0xffff).toString(16)]
}

function parseIpv6(address) {
  const clean = address.toLowerCase().split('%')[0]
  if (net.isIP(clean) !== 6) return null
  const halves = clean.split('::')
  let head = expandIpv4Tail(halves[0] ? halves[0].split(':') : [])
  let tail = expandIpv4Tail(halves[1] ? halves[1].split(':') : [])
  if (halves.length === 1 && head.length !== 8) return null
  if (halves.length === 2) {
    const missing = 8 - head.length - tail.length
    if (missing < 1) return null
    head = [...head, ...Array(missing).fill('0')]
  }
  const parts = [...head, ...tail]
  if (parts.length !== 8) return null
  return parts.reduce((value, part) => (value << 16n) | BigInt(`0x${part || '0'}`), 0n)
}

function isIpv6InRange(address, base, prefix) {
  const value = parseIpv6(address)
  const start = parseIpv6(base)
  if (value === null || start === null) return false
  const shift = BigInt(128 - prefix)
  return (value >> shift) === (start >> shift)
}

function isPublicIpAddress(address) {
  const version = net.isIP(address)
  if (version === 4) {
    const blocked = [
      ['0.0.0.0', 8],
      ['10.0.0.0', 8],
      ['100.64.0.0', 10],
      ['127.0.0.0', 8],
      ['169.254.0.0', 16],
      ['172.16.0.0', 12],
      ['192.0.0.0', 24],
      ['192.0.2.0', 24],
      ['192.168.0.0', 16],
      ['198.18.0.0', 15],
      ['198.51.100.0', 24],
      ['203.0.113.0', 24],
      ['224.0.0.0', 4],
      ['240.0.0.0', 4],
    ]
    return !blocked.some(([base, prefix]) => isIpv4InRange(address, base, prefix))
  }
  if (version === 6) {
    const blocked = [
      ['::', 128],
      ['::1', 128],
      ['::ffff:0:0', 96],
      ['100::', 64],
      ['2001:db8::', 32],
      ['fc00::', 7],
      ['fe80::', 10],
      ['ff00::', 8],
    ]
    return !blocked.some(([base, prefix]) => isIpv6InRange(address, base, prefix))
  }
  return false
}

function parseUrl(value) {
  try {
    return new URL(value)
  } catch {
    return null
  }
}

function isSafeExternalUrl(value) {
  const url = parseUrl(value)
  if (!url || url.protocol !== 'https:' || url.username || url.password) return false
  const hostname = url.hostname.replace(/^\[|\]$/g, '')
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) return false
  return net.isIP(hostname) === 0 || isPublicIpAddress(hostname)
}

function isTrustedRendererUrl(value, options) {
  const url = parseUrl(value)
  if (!url) return false
  if (!options.isPackaged) return url.origin === options.devOrigin
  if (url.protocol !== 'file:') return false
  try {
    return path.resolve(fileURLToPath(url)) === path.resolve(options.entryPath)
  } catch {
    return false
  }
}

function assertSafeRemoteUrl(value, resolvedAddresses) {
  const url = parseUrl(value)
  if (!url) throw new Error('Enter a valid HTTPS URL.')
  if (url.protocol !== 'https:') throw new Error('Only HTTPS URLs are supported.')
  if (url.username || url.password) throw new Error('URLs containing credentials are not supported.')

  const hostname = url.hostname.replace(/^\[|\]$/g, '')
  const addresses = net.isIP(hostname) ? [hostname] : resolvedAddresses
  if (!addresses?.length || addresses.some(item => !isPublicIpAddress(typeof item === 'string' ? item : item.address))) {
    throw new Error('URL must resolve to a public internet address.')
  }
  return url
}

async function defaultResolveHost(hostname) {
  return dns.lookup(hostname, { all: true, verbatim: true })
}

function defaultRequestOnce(url, addresses, options = {}) {
  const timeoutMs = options.timeoutMs ?? 15000
  const maxBytes = options.maxBytes ?? MAX_MARKDOWN_BYTES
  const hostname = url.hostname.replace(/^\[|\]$/g, '')
  const normalizedAddresses = addresses.map(item => typeof item === 'string'
    ? { address: item, family: net.isIP(item) }
    : item)

  return new Promise((resolve, reject) => {
    const request = https.get({
      protocol: 'https:',
      hostname,
      port: url.port || 443,
      path: `${url.pathname}${url.search}`,
      servername: net.isIP(hostname) ? undefined : hostname,
      headers: {
        Accept: 'text/markdown, text/plain, text/*;q=0.9, */*;q=0.1',
        'Accept-Encoding': 'identity',
      },
      lookup: (_lookupHostname, lookupOptions, callback) => {
        if (lookupOptions.all) {
          callback(null, normalizedAddresses)
          return
        }
        const selected = normalizedAddresses[0]
        callback(null, selected.address, selected.family)
      },
    }, response => {
      const declaredSize = Number(response.headers['content-length'])
      try {
        if (Number.isFinite(declaredSize)) assertMarkdownSize(declaredSize)
      } catch (error) {
        response.destroy()
        reject(error)
        return
      }

      const chunks = []
      let totalBytes = 0
      response.on('data', chunk => {
        totalBytes += chunk.length
        if (totalBytes > maxBytes) {
          response.destroy(new Error('Markdown file is larger than 5 MB.'))
          return
        }
        chunks.push(chunk)
      })
      response.on('end', () => {
        resolve({
          statusCode: response.statusCode ?? 0,
          headers: response.headers,
          body: Buffer.concat(chunks),
        })
      })
      response.on('error', reject)
    })

    request.setTimeout(timeoutMs, () => request.destroy(new Error('Request timed out. Try again.')))
    request.on('error', reject)
  })
}

async function fetchMarkdownUrl(value, dependencies = {}) {
  const resolveHost = dependencies.resolveHost ?? defaultResolveHost
  const requestOnce = dependencies.requestOnce ?? defaultRequestOnce
  let currentValue = value

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    let parsed
    try {
      parsed = new URL(currentValue)
    } catch {
      throw new Error('Enter a valid HTTPS URL.')
    }
    const hostname = parsed.hostname.replace(/^\[|\]$/g, '')
    const addresses = net.isIP(hostname)
      ? [{ address: hostname, family: net.isIP(hostname) }]
      : await resolveHost(hostname)
    const url = assertSafeRemoteUrl(parsed.href, addresses)
    const response = await requestOnce(url, addresses, {
      timeoutMs: 15000,
      maxBytes: MAX_MARKDOWN_BYTES,
    })

    if (response.statusCode >= 300 && response.statusCode < 400) {
      const location = response.headers.location
      if (!location) throw new Error(`Request failed: HTTP ${response.statusCode}.`)
      if (redirectCount === MAX_REDIRECTS) throw new Error('URL redirected too many times.')
      currentValue = new URL(location, url).href
      continue
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw new Error(`Request failed: HTTP ${response.statusCode}.`)
    }

    assertMarkdownSize(response.body.length)
    return { content: response.body.toString('utf-8'), url: url.href }
  }

  throw new Error('URL redirected too many times.')
}

function isMarkdownPath(filePath) {
  return typeof filePath === 'string' && MARKDOWN_EXTENSIONS.has(path.extname(filePath).toLowerCase())
}

class AuthorizedFiles {
  constructor() {
    this.paths = new Set()
  }

  authorize(filePath) {
    if (!isMarkdownPath(filePath)) throw new Error('Select a Markdown file.')
    const normalized = path.resolve(filePath)
    this.paths.add(normalized)
    return normalized
  }

  has(filePath) {
    return typeof filePath === 'string' && this.paths.has(path.resolve(filePath))
  }
}

function assertMarkdownSize(size) {
  if (!Number.isSafeInteger(size) || size < 0 || size > MAX_MARKDOWN_BYTES) {
    throw new Error('Markdown file is larger than 5 MB.')
  }
}

module.exports = {
  AuthorizedFiles,
  MAX_MARKDOWN_BYTES,
  assertMarkdownSize,
  assertSafeRemoteUrl,
  fetchMarkdownUrl,
  isMarkdownPath,
  isPublicIpAddress,
  isSafeExternalUrl,
  isTrustedRendererUrl,
}
