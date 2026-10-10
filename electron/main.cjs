const { app, BrowserWindow, ipcMain, nativeTheme, Menu, dialog, clipboard, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const chokidar = require('chokidar')
const { createUpdateService } = require('./update-service.cjs')
const {
  AuthorizedFiles,
  assertMarkdownSize,
  fetchMarkdownUrl,
  isMarkdownPath,
  isSafeExternalUrl,
  isTrustedRendererUrl,
} = require('./security.cjs')

let mainWin
let updateService = null
let watcher = null
let pendingOpenFiles = []
let rendererReady = false
const RECENT_MAX = 10
const DEV_ORIGIN = process.env.MARKFLY_DEV_ORIGIN || 'http://localhost:5173'
let recentFiles = []
const authorizedFiles = new AuthorizedFiles()

function getRendererTrustOptions() {
  return app.isPackaged
    ? { isPackaged: true, entryPath: path.join(__dirname, '..', 'dist', 'index.html') }
    : { isPackaged: false, devOrigin: DEV_ORIGIN }
}

function assertTrustedSender(event) {
  const frame = event.senderFrame
  if (
    !mainWin ||
    mainWin.isDestroyed() ||
    !frame ||
    frame !== mainWin.webContents.mainFrame ||
    !isTrustedRendererUrl(frame.url, getRendererTrustOptions())
  ) {
    throw new Error('Blocked IPC request from an untrusted renderer.')
  }
}

function handleTrusted(channel, handler) {
  ipcMain.handle(channel, async (event, ...args) => {
    assertTrustedSender(event)
    return handler(event, ...args)
  })
}

function readPrefs(prefsPath) {
  try { return JSON.parse(fs.readFileSync(prefsPath, 'utf-8')) } catch { return {} }
}

function authorizeSavedFiles(pref) {
  if (!Array.isArray(pref.tabs)) return
  for (const tab of pref.tabs) {
    const filePath = typeof tab === 'string' ? tab : tab?.path
    if (typeof filePath !== 'string' || /^https:\/\//i.test(filePath) || !isMarkdownPath(filePath)) continue
    try {
      if (fs.statSync(filePath).isFile()) authorizedFiles.authorize(filePath)
    } catch { /* stale saved file */ }
  }
}

function sanitizePreferences(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const result = {}
  if (typeof value.dark === 'boolean') result.dark = value.dark
  if (typeof value.sidebarVisible === 'boolean') result.sidebarVisible = value.sidebarVisible
  if (typeof value.sidebarWidth === 'number' && value.sidebarWidth >= 180 && value.sidebarWidth <= 400) {
    result.sidebarWidth = value.sidebarWidth
  }

  const tabs = Array.isArray(value.tabs)
    ? value.tabs.flatMap(tab => {
        const filePath = typeof tab === 'string' ? tab : tab?.path
        const allowed = typeof filePath === 'string' && (
          authorizedFiles.has(filePath) || isSafeExternalUrl(filePath)
        )
        return allowed ? [{ path: filePath, active: typeof tab === 'string' || tab.active !== false }] : []
      })
    : []
  result.tabs = tabs

  const tabPaths = new Set(tabs.map(tab => tab.path))
  result.activePath = typeof value.activePath === 'string' && tabPaths.has(value.activePath)
    ? value.activePath
    : null
  result.views = {}
  if (value.views && typeof value.views === 'object' && !Array.isArray(value.views)) {
    for (const [filePath, view] of Object.entries(value.views)) {
      if (!tabPaths.has(filePath) || !view || typeof view !== 'object' || Array.isArray(view)) continue
      result.views[filePath] = {
        zoom: typeof view.zoom === 'number' && view.zoom >= 0.5 && view.zoom <= 3 ? view.zoom : 1,
        showRaw: view.showRaw === true,
      }
    }
  }
  return result
}

function readAuthorizedFile(filePath) {
  if (!authorizedFiles.has(filePath)) throw new Error('File access was not authorized.')
  const stat = fs.statSync(filePath)
  if (!stat.isFile()) throw new Error('Selected path is not a file.')
  assertMarkdownSize(stat.size)
  const content = fs.readFileSync(filePath)
  assertMarkdownSize(content.byteLength)
  return content.toString('utf-8')
}

// --- Menu ---
function buildMenu() {
  const isMac = process.platform === 'darwin'
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'Open',
          accelerator: 'CmdOrCtrl+O',
          click: () => openFileDialog(),
        },
        {
          label: 'Open Recent',
          submenu: recentFiles.length > 0
            ? recentFiles.map(f => ({
                label: f,
                click: () => openFile(f),
              }))
            : [{ label: 'No Recent Files', enabled: false }],
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    { role: 'editMenu' },
    {
      label: 'Help',
      submenu: [{
        label: 'Check for Updates…',
        click: () => updateService?.checkForUpdates(),
      }],
    },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
  ]
  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

function updateRecentMenu() {
  // Rebuild menu to refresh Open Recent submenu
  buildMenu()
}

function addRecent(filePath) {
  recentFiles = recentFiles.filter(f => f !== filePath)
  recentFiles.unshift(filePath)
  if (recentFiles.length > RECENT_MAX) recentFiles.pop()
  app.addRecentDocument(filePath)
  updateRecentMenu()
}

// --- File ops ---
function openFileDialog() {
  if (!mainWin) return
  dialog.showOpenDialog(mainWin, {
    properties: ['openFile'],
    filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
  }).then(result => {
    if (!result.canceled && result.filePaths.length > 0) {
      openFile(result.filePaths[0])
    }
  })
}

function openFile(filePath) {
  if (!mainWin || mainWin.isDestroyed()) return
  let normalized
  try {
    normalized = authorizedFiles.authorize(filePath)
  } catch {
    return
  }
  addRecent(normalized)
  if (!rendererReady) {
    pendingOpenFiles.push(normalized)
    return
  }
  mainWin.webContents.send('open-file', normalized)
  mainWin.focus()
}

// --- IPC handlers ---
function setupIPC() {
  handleTrusted('copy-text', (_event, text) => {
    if (typeof text !== 'string') return false
    clipboard.writeText(text)
    return true
  })

  handleTrusted('read-file', async (_event, filePath) => {
    return readAuthorizedFile(filePath)
  })

  handleTrusted('fetch-markdown-url', async (_event, value) => {
    let url = value
    let parsed
    try { parsed = new URL(value) } catch { /* validated by fetchMarkdownUrl */ }
    if (parsed?.hostname === 'github.com') {
      const parts = parsed.pathname.split('/').filter(Boolean)
      const blobIndex = parts.indexOf('blob')
      if (parts.length > blobIndex + 1 && blobIndex === 2) {
        const rawUrl = new URL(`https://raw.githubusercontent.com/${parts.slice(0, 2).join('/')}/${parts.slice(3).join('/')}`)
        rawUrl.search = parsed.search
        url = rawUrl.href
      }
    }
    return fetchMarkdownUrl(url)
  })

  handleTrusted('watch-file', async (_event, filePath) => {
    if (!authorizedFiles.has(filePath)) throw new Error('File access was not authorized.')
    if (watcher) watcher.close()
    watcher = chokidar.watch(filePath, { persistent: true })
    watcher.on('change', () => {
      if (mainWin && !mainWin.isDestroyed()) {
        mainWin.webContents.send('file-changed')
      }
    })
  })

  handleTrusted('get-args', async () => {
    const args = process.argv.slice(1)
    const filePath = args.find(isMarkdownPath)
    return filePath ? authorizedFiles.authorize(filePath) : null
  })

  handleTrusted('renderer-ready', async () => {
    rendererReady = true
    for (const filePath of pendingOpenFiles) {
      try {
        const normalized = authorizedFiles.authorize(filePath)
        if (mainWin && !mainWin.isDestroyed()) mainWin.webContents.send('open-file', normalized)
      } catch { /* ignore unsupported open-file events */ }
    }
    pendingOpenFiles = []
  })

  handleTrusted('get-theme', async () => {
    return nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
  })

  handleTrusted('open-file-dialog', async () => {
    if (!mainWin) return null
    const result = await dialog.showOpenDialog(mainWin, {
      properties: ['openFile'],
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
    })
    if (!result.canceled && result.filePaths.length > 0) {
      const fp = authorizedFiles.authorize(result.filePaths[0])
      addRecent(fp)
      return fp
    }
    return null
  })

  handleTrusted('open-file-path', async (_event, filePath) => {
    if (!authorizedFiles.has(filePath)) throw new Error('File access was not authorized.')
    addRecent(filePath)
    return true
  })

  handleTrusted('open-dropped-file', async (_event, filePath) => {
    const normalized = authorizedFiles.authorize(filePath)
    const content = readAuthorizedFile(normalized)
    addRecent(normalized)
    return { path: normalized, content }
  })

  handleTrusted('open-external', async (_event, value) => {
    if (!isSafeExternalUrl(value)) throw new Error('Only safe HTTPS links can be opened.')
    await shell.openExternal(value)
    return true
  })

  handleTrusted('get-update-state', async () => updateService.getState())
  handleTrusted('update-check', async () => updateService.checkForUpdates())
  handleTrusted('update-download', async () => updateService.downloadUpdate())
  handleTrusted('update-open-installer', async () => updateService.openInstaller())
  handleTrusted('update-open-release', async () => updateService.openRelease())

  handleTrusted('get-recent-files', async () => {
    return [...recentFiles]
  })

  const prefsPath = path.join(app.getPath('userData'), 'prefs.json')
  authorizeSavedFiles(readPrefs(prefsPath))
  handleTrusted('load-pref', async () => {
    return sanitizePreferences(readPrefs(prefsPath))
  })
  handleTrusted('save-pref', async (_event, obj) => {
    fs.writeFileSync(prefsPath, JSON.stringify(sanitizePreferences(obj)), 'utf-8')
  })
}

// --- Window ---
function createWindow() {
  const isDev = !app.isPackaged
  mainWin = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 500,
    minHeight: 400,
    title: 'Markfly',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
      navigateOnDragDrop: false,
    },
  })

  mainWin.webContents.on('will-navigate', (event, url) => {
    if (!isTrustedRendererUrl(url, getRendererTrustOptions())) event.preventDefault()
  })
  mainWin.webContents.on('will-redirect', (event, url) => {
    if (!isTrustedRendererUrl(url, getRendererTrustOptions())) event.preventDefault()
  })
  mainWin.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  mainWin.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false))

  rendererReady = false
  if (pendingOpenFiles.length === 0) {
    const initialPath = process.argv.slice(1).find(isMarkdownPath)
    if (initialPath) pendingOpenFiles.push(authorizedFiles.authorize(initialPath))
  }

  const loadPromise = isDev
    ? mainWin.loadURL(DEV_ORIGIN)
    : mainWin.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  loadPromise.catch(error => console.error('Failed to load window:', error))
}

// Register at module level — macOS open-file fires before ready
app.on('open-file', (event, filePath) => {
  event.preventDefault()
  if (mainWin && !mainWin.isDestroyed()) {
    openFile(filePath)
  } else {
    pendingOpenFiles.push(filePath)
    if ((!mainWin || mainWin.isDestroyed()) && app.isReady()) {
      createWindow()
    }
  }
})

app.whenReady().then(() => {
  updateService = createUpdateService({
    currentVersion: app.getVersion(),
    architecture: process.arch,
    userDataPath: app.getPath('userData'),
    openPath: filePath => shell.openPath(filePath),
    openExternal: url => shell.openExternal(url),
    publishState: state => {
      if (mainWin && !mainWin.isDestroyed()) mainWin.webContents.send('update-state', state)
    },
  })
  buildMenu()
  setupIPC()
  createWindow()
  updateService.checkOnStartup().catch(error => console.error('Automatic update check failed:', error))
})

app.on('before-quit', () => {
  updateService?.dispose()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})
