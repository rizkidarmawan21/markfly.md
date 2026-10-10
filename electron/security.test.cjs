const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const {
  AuthorizedFiles,
  assertMarkdownSize,
  assertSafeRemoteUrl,
  fetchMarkdownUrl,
  isPublicIpAddress,
  isSafeExternalUrl,
  isTrustedRendererUrl,
} = require('./security.cjs')

test('external links allow HTTPS without credentials only', () => {
  assert.equal(isSafeExternalUrl('https://example.com/docs'), true)
  assert.equal(isSafeExternalUrl('http://example.com/docs'), false)
  assert.equal(isSafeExternalUrl('https://user:pass@example.com/docs'), false)
  assert.equal(isSafeExternalUrl('javascript:alert(1)'), false)
  assert.equal(isSafeExternalUrl('not a URL'), false)
})

test('trusted renderer URL accepts only the configured app entry', () => {
  const entryPath = path.resolve('/Applications/Markfly.app/Contents/Resources/app.asar/dist/index.html')

  assert.equal(isTrustedRendererUrl('file:///Applications/Markfly.app/Contents/Resources/app.asar/dist/index.html', {
    isPackaged: true,
    entryPath,
  }), true)
  assert.equal(isTrustedRendererUrl('file:///tmp/index.html', { isPackaged: true, entryPath }), false)
  assert.equal(isTrustedRendererUrl('https://attacker.example/', { isPackaged: true, entryPath }), false)
  assert.equal(isTrustedRendererUrl('http://localhost:5173/src/main.ts', {
    isPackaged: false,
    devOrigin: 'http://localhost:5173',
  }), true)
  assert.equal(isTrustedRendererUrl('http://127.0.0.1:5173/', {
    isPackaged: false,
    devOrigin: 'http://localhost:5173',
  }), false)
})

test('public address check rejects local and reserved IPv4 ranges', () => {
  for (const address of [
    '0.0.0.0', '10.0.0.1', '100.64.0.1', '127.0.0.1', '169.254.169.254',
    '172.16.0.1', '192.168.1.1', '192.0.2.1', '198.18.0.1', '198.51.100.1',
    '203.0.113.1', '224.0.0.1', '255.255.255.255',
  ]) {
    assert.equal(isPublicIpAddress(address), false, address)
  }
  assert.equal(isPublicIpAddress('8.8.8.8'), true)
})

test('public address check rejects local and reserved IPv6 ranges', () => {
  for (const address of ['::', '::1', 'fc00::1', 'fd12::1', 'fe80::1', 'ff02::1', '2001:db8::1', '::ffff:127.0.0.1']) {
    assert.equal(isPublicIpAddress(address), false, address)
  }
  assert.equal(isPublicIpAddress('2606:4700:4700::1111'), true)
})

test('remote URL validation rejects unsafe schemes, credentials, and resolved addresses', () => {
  assert.equal(
    assertSafeRemoteUrl('https://example.com/readme.md', ['93.184.216.34']).href,
    'https://example.com/readme.md',
  )
  assert.throws(() => assertSafeRemoteUrl('http://example.com/readme.md', ['93.184.216.34']), /HTTPS/)
  assert.throws(() => assertSafeRemoteUrl('https://user:pass@example.com/readme.md', ['93.184.216.34']), /credentials/)
  assert.throws(() => assertSafeRemoteUrl('https://localhost/readme.md', ['127.0.0.1']), /public internet address/)
  assert.throws(() => assertSafeRemoteUrl('https://example.com/readme.md', ['10.0.0.2']), /public internet address/)
})

test('authorized file registry grants exact Markdown paths only', () => {
  const files = new AuthorizedFiles()
  const selected = files.authorize('/tmp/docs/readme.md')

  assert.equal(selected, path.resolve('/tmp/docs/readme.md'))
  assert.equal(files.has('/tmp/docs/readme.md'), true)
  assert.equal(files.has('/tmp/docs/../secrets.txt'), false)
  assert.throws(() => files.authorize('/tmp/docs/data.json'), /Markdown file/)
})

test('Markdown size limit accepts the boundary and rejects larger content', () => {
  assert.doesNotThrow(() => assertMarkdownSize(5 * 1024 * 1024))
  assert.throws(() => assertMarkdownSize((5 * 1024 * 1024) + 1), /larger than 5 MB/)
})

test('URL fetch returns bounded Markdown from a validated public address', async () => {
  const result = await fetchMarkdownUrl('https://example.com/readme.md', {
    resolveHost: async () => [{ address: '93.184.216.34', family: 4 }],
    requestOnce: async () => ({
      statusCode: 200,
      headers: { 'content-length': '6' },
      body: Buffer.from('# Safe'),
    }),
  })

  assert.deepEqual(result, { content: '# Safe', url: 'https://example.com/readme.md' })
})

test('URL fetch validates redirect destinations before requesting them', async () => {
  let requests = 0
  await assert.rejects(() => fetchMarkdownUrl('https://example.com/readme.md', {
    resolveHost: async hostname => hostname === 'example.com'
      ? [{ address: '93.184.216.34', family: 4 }]
      : [{ address: '127.0.0.1', family: 4 }],
    requestOnce: async () => {
      requests += 1
      return {
        statusCode: 302,
        headers: { location: 'https://localhost/internal' },
        body: Buffer.alloc(0),
      }
    },
  }), /public internet address/)
  assert.equal(requests, 1)
})

test('URL fetch rejects oversized response bodies without trusting Content-Length', async () => {
  await assert.rejects(() => fetchMarkdownUrl('https://example.com/readme.md', {
    resolveHost: async () => [{ address: '93.184.216.34', family: 4 }],
    requestOnce: async () => ({
      statusCode: 200,
      headers: {},
      body: Buffer.alloc((5 * 1024 * 1024) + 1),
    }),
  }), /larger than 5 MB/)
})
