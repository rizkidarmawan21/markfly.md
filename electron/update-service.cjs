const crypto = require('node:crypto')
const fs = require('node:fs')
const https = require('node:https')
const os = require('node:os')
const path = require('node:path')
const { URL } = require('node:url')

const RELEASE_API = 'https://api.github.com/repos/rizkidarmawan21/markfly.md/releases/latest'
const RELEASE_PAGE = 'https://github.com/rizkidarmawan21/markfly.md/releases/tag/'
const MAX_PACKAGE_BYTES = 250 * 1024 * 1024
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000
const REQUEST_TIMEOUT_MS = 15_000
const DOWNLOAD_TIMEOUT_MS = 10 * 60 * 1000
const ALLOWED_DOWNLOAD_HOSTS = new Set(['github.com', 'release-assets.githubusercontent.com'])

function parseVersion(value) {
  if (typeof value !== 'string') return null
  const match = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(value)
  if (!match) return null
  const parts = match.slice(1).map(Number)
  return parts.every(Number.isSafeInteger) ? parts : null
}

function compareVersions(left, right) {
  for (let i = 0; i < left.length; i += 1) {
    if (left[i] !== right[i]) return left[i] > right[i] ? 1 : -1
  }
  return 0
}

function assertHttpsUrl(value, allowedHosts) {
  let url
  try { url = new URL(value) } catch { throw new Error('Release contains an invalid URL.') }
  if (url.protocol !== 'https:' || url.username || url.password || !allowedHosts.has(url.hostname)) {
    throw new Error('Release contains an unsafe URL.')
  }
  return url
}

function requestJson(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    const parsed = assertHttpsUrl(url, new Set(['api.github.com']))
    const request = https.get(parsed, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Markfly-Updater' },
      timeout: REQUEST_TIMEOUT_MS,
    }, response => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
        response.resume()
        if (redirects >= 3 || typeof response.headers.location !== 'string') {
          reject(new Error('GitHub release lookup returned an invalid redirect.'))
          return
        }
        const next = new URL(response.headers.location, parsed)
        if (next.protocol !== 'https:' || next.hostname !== 'api.github.com') {
          reject(new Error('GitHub release lookup redirected outside GitHub API.'))
          return
        }
        requestJson(next.href, redirects + 1).then(resolve, reject)
        return
      }
      if (response.statusCode !== 200) {
        response.resume()
        reject(new Error(response.statusCode === 403 ? 'GitHub rate limit reached. Try again later.' : `GitHub release check failed (HTTP ${response.statusCode}).`))
        return
      }
      let body = ''
      response.setEncoding('utf8')
      response.on('data', chunk => {
        body += chunk
        if (body.length > 1024 * 1024) request.destroy(new Error('GitHub release response was too large.'))
      })
      response.on('end', () => {
        try { resolve(JSON.parse(body)) } catch { reject(new Error('GitHub returned invalid release data.')) }
      })
      response.on('error', reject)
    })
    request.on('timeout', () => request.destroy(new Error('GitHub release check timed out.')))
    request.on('error', reject)
  })
}

function downloadToFile(initialUrl, destination, expectedSize, onProgress, redirects = 0, received = 0) {
  return new Promise((resolve, reject) => {
    let parsed
    try { parsed = assertHttpsUrl(initialUrl, ALLOWED_DOWNLOAD_HOSTS) } catch (error) { reject(error); return }
    if (parsed.hostname === 'github.com' && !parsed.pathname.startsWith('/rizkidarmawan21/markfly.md/releases/download/')) {
      reject(new Error('Installer URL is outside the Markfly releases.'))
      return
    }
    const request = https.get(parsed, { headers: { 'User-Agent': 'Markfly-Updater' }, timeout: DOWNLOAD_TIMEOUT_MS }, response => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
        response.resume()
        if (redirects >= 4 || typeof response.headers.location !== 'string') {
          reject(new Error('Installer download returned an invalid redirect.'))
          return
        }
        const next = new URL(response.headers.location, parsed)
        if (next.protocol !== 'https:' || !ALLOWED_DOWNLOAD_HOSTS.has(next.hostname)) {
          reject(new Error('Installer download redirected to an untrusted host.'))
          return
        }
        downloadToFile(next.href, destination, expectedSize, onProgress, redirects + 1, received).then(resolve, reject)
        return
      }
      if (response.statusCode !== 200) {
        response.resume()
        reject(new Error(`Installer download failed (HTTP ${response.statusCode}).`))
        return
      }
      const contentLength = Number(response.headers['content-length'])
      if (Number.isSafeInteger(contentLength) && contentLength > MAX_PACKAGE_BYTES) {
        response.destroy(new Error('Installer exceeds the 250 MiB download limit.'))
        reject(new Error('Installer exceeds the 250 MiB download limit.'))
        return
      }
      const totalBytes = Number.isSafeInteger(contentLength) && contentLength >= 0 ? contentLength : null
      const output = fs.createWriteStream(destination, { flags: received ? 'a' : 'w', mode: 0o600 })
      let bytesReceived = received
      let settled = false
      const fail = error => {
        if (settled) return
        settled = true
        output.destroy()
        response.destroy()
        reject(error)
      }
      response.on('data', chunk => {
        bytesReceived += chunk.length
        if (bytesReceived > MAX_PACKAGE_BYTES || bytesReceived > expectedSize) {
          fail(new Error('Installer exceeded its expected size.'))
          return
        }
        onProgress(bytesReceived, totalBytes)
      })
      response.on('error', fail)
      output.on('error', fail)
      response.pipe(output)
      output.on('finish', () => {
        if (settled) return
        settled = true
        if (bytesReceived !== expectedSize) {
          reject(new Error('Installer size did not match GitHub release metadata.'))
          return
        }
        resolve(bytesReceived)
      })
    })
    request.on('timeout', () => request.destroy(new Error('Installer download timed out.')))
    request.on('error', reject)
  })
}

function hashFileWithReadStream(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256')
    const input = fs.createReadStream(filePath)
    input.on('data', chunk => hash.update(chunk))
    input.on('error', reject)
    input.on('end', () => resolve(`sha256:${hash.digest('hex')}`))
  })
}

function createUpdateService({ currentVersion, architecture, userDataPath, openPath, openExternal, publishState = () => {} }) {
  const installedVersion = parseVersion(currentVersion)
  let state = {
    revision: 0,
    status: 'idle',
    currentVersion,
    latestVersion: null,
    releaseInfoAvailable: false,
    bytesReceived: 0,
    totalBytes: null,
    error: null,
  }
  let latestReleaseUrl = null
  let validatedAsset = null
  let installerPath = null
  let partialPath = null
  let partialDir = null
  let checkPromise = null
  let downloadPromise = null

  function setState(patch) {
    state = { ...state, ...patch, revision: state.revision + 1 }
    publishState({ ...state })
    return { ...state }
  }

  async function performCheck() {
    setState({ status: 'checking', error: null, bytesReceived: 0, totalBytes: null })
    try {
      const release = await requestJson(RELEASE_API)
      if (!release || typeof release !== 'object' || release.draft || release.prerelease) {
        throw new Error('GitHub latest release data is invalid.')
      }
      const latestVersion = parseVersion(release.tag_name)
      if (!latestVersion) throw new Error('GitHub release version is invalid.')
      const versionText = latestVersion.join('.')
      const expectedReleaseUrl = `${RELEASE_PAGE}${release.tag_name}`
      const releaseUrl = assertHttpsUrl(release.html_url, new Set(['github.com']))
      if (releaseUrl.href !== expectedReleaseUrl) throw new Error('GitHub release link did not match the release version.')
      latestReleaseUrl = releaseUrl.href
      const releaseInfoAvailable = true
      const common = { latestVersion: versionText, releaseInfoAvailable, error: null }

      if (!installedVersion) throw new Error('Installed Markfly version is invalid.')
      const comparison = compareVersions(latestVersion, installedVersion)
      if (comparison <= 0) {
        validatedAsset = null
        installerPath = null
        return setState({ ...common, status: 'current' })
      }
      if (architecture !== 'arm64') {
        validatedAsset = null
        return setState({ ...common, status: 'error', error: 'Updates are currently available only for Apple silicon (arm64).' })
      }
      const expectedName = `Markfly-${versionText}-arm64.pkg`
      const assets = Array.isArray(release.assets) ? release.assets : []
      const matches = assets.filter(asset => asset?.name === expectedName)
      if (matches.length !== 1) {
        validatedAsset = null
        return setState({ ...common, status: 'error', error: 'No unique compatible installer in this release.' })
      }
      const asset = matches[0]
      if (!Number.isSafeInteger(asset.size) || asset.size <= 0 || asset.size > MAX_PACKAGE_BYTES) {
        throw new Error('GitHub installer size is invalid or exceeds the 250 MiB limit.')
      }
      const expectedDownloadUrl = `https://github.com/rizkidarmawan21/markfly.md/releases/download/${release.tag_name}/${expectedName}`
      const downloadUrl = assertHttpsUrl(asset.browser_download_url, new Set(['github.com']))
      if (downloadUrl.href !== expectedDownloadUrl) throw new Error('Installer URL did not match the selected release asset.')
      if (asset.digest != null && !/^sha256:[a-f\d]{64}$/i.test(asset.digest)) throw new Error('GitHub installer checksum format is invalid.')
      validatedAsset = { name: expectedName, size: asset.size, digest: asset.digest || null, url: downloadUrl.href, version: versionText }
      installerPath = null
      return setState({ ...common, status: 'available' })
    } catch (error) {
      return setState({ status: 'error', error: error instanceof Error ? error.message : 'Update check failed.' })
    }
  }

  function checkForUpdates() {
    if (checkPromise) return checkPromise
    checkPromise = performCheck().finally(() => { checkPromise = null })
    return checkPromise
  }

  async function checkOnStartup() {
    const timestampPath = path.join(userDataPath, 'update-check.json')
    let previousCheck = 0
    try {
      const saved = JSON.parse(fs.readFileSync(timestampPath, 'utf8'))
      if (Number.isSafeInteger(saved.lastCheckedAt) && saved.lastCheckedAt > 0) previousCheck = saved.lastCheckedAt
    } catch { /* malformed/missing timestamp means check now */ }
    if (Date.now() - previousCheck < CHECK_INTERVAL_MS) return getState()
    try {
      fs.mkdirSync(userDataPath, { recursive: true })
      fs.writeFileSync(timestampPath, JSON.stringify({ lastCheckedAt: Date.now() }), { mode: 0o600 })
    } catch { /* update checks remain available if timestamp cannot be persisted */ }
    return checkForUpdates()
  }

  async function downloadUpdate() {
    if (downloadPromise) return downloadPromise
    if (!validatedAsset) return setState({ status: 'error', error: 'Check for a compatible update first.' })
    downloadPromise = (async () => {
      setState({ status: 'downloading', bytesReceived: 0, totalBytes: validatedAsset.size, error: null })
      try {
        const downloadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'markfly-update-'))
        partialDir = downloadDir
        partialPath = path.join(downloadDir, validatedAsset.name)
        await downloadToFile(validatedAsset.url, partialPath, validatedAsset.size, (bytesReceived, totalBytes) => {
          setState({ status: 'downloading', bytesReceived, totalBytes })
        })
        const stat = fs.statSync(partialPath)
        if (stat.size !== validatedAsset.size) throw new Error('Installer size did not match GitHub release metadata.')
        if (validatedAsset.digest) {
          const digest = await hashFileWithReadStream(partialPath)
          if (digest.toLowerCase() !== validatedAsset.digest.toLowerCase()) throw new Error('Installer checksum did not match GitHub.')
        }
        installerPath = partialPath
        partialPath = null
        partialDir = null
        return setState({ status: 'ready', bytesReceived: stat.size, totalBytes: stat.size, error: null })
      } catch (error) {
        if (partialPath) {
          try { fs.unlinkSync(partialPath) } catch { /* partial already removed */ }
          partialPath = null
        }
        if (partialDir) {
          try { fs.rmdirSync(partialDir) } catch { /* directory already removed */ }
          partialDir = null
        }
        installerPath = null
        return setState({ status: 'error', error: error instanceof Error ? error.message : 'Installer download failed.' })
      }
    })().finally(() => { downloadPromise = null })
    return downloadPromise
  }

  async function openInstaller() {
    if (!installerPath || state.status !== 'ready') return setState({ status: 'error', error: 'No verified installer is ready to open.' })
    const verifiedPath = installerPath
    try {
      const error = await openPath(verifiedPath)
      if (error) return setState({ status: 'error', error: `Could not open Installer: ${error}` })
      return setState({ status: 'opening', error: 'Finish installation in macOS Installer, then reopen Markfly.' })
    } catch (error) {
      return setState({ status: 'error', error: `Could not open Installer: ${error instanceof Error ? error.message : 'unknown error'}` })
    }
  }

  async function dispose() {
    if (partialPath) {
      try { fs.unlinkSync(partialPath) } catch { /* partial already removed */ }
      partialPath = null
    }
    if (partialDir) {
      try { fs.rmdirSync(partialDir) } catch { /* directory already removed */ }
      partialDir = null
    }
  }

  function openRelease() {
    if (!latestReleaseUrl) throw new Error('No validated GitHub release link is available.')
    return openExternal(latestReleaseUrl)
  }

  function getState() { return { ...state } }

  return { getState, checkForUpdates, checkOnStartup, downloadUpdate, openInstaller, openRelease, dispose }
}

module.exports = { createUpdateService, parseVersion, compareVersions }
