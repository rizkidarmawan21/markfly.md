const { app, BrowserWindow, ipcMain, nativeTheme, Menu, dialog, clipboard } = require('electron')
const path = require('path')
const fs = require('fs')
const chokidar = require('chokidar')

let mainWin
let watcher = null
let pendingOpenFiles = []
let rendererReady = false
const RECENT_MAX = 10
let recentFiles = []

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
  addRecent(filePath)
  if (!rendererReady) {
    pendingOpenFiles.push(filePath)
    return
  }
  mainWin.webContents.send('open-file', filePath)
  mainWin.focus()
}

// --- IPC handlers ---
function setupIPC() {
  ipcMain.handle('copy-text', (_event, text) => {
    if (typeof text !== 'string') return false
    clipboard.writeText(text)
    return true
  })

  ipcMain.handle('read-file', async (_event, filePath) => {
    try { return fs.readFileSync(filePath, 'utf-8') } catch { return null }
  })

  ipcMain.handle('fetch-markdown-url', async (_event, value) => {
    let url
    try { url = new URL(value) } catch { throw new Error('Enter a valid http or https URL.') }
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('Only http and https URLs are supported.')
    }
    if (url.hostname === 'github.com') {
      const parts = url.pathname.split('/').filter(Boolean)
      const blobIndex = parts.indexOf('blob')
      if (parts.length > blobIndex + 1 && blobIndex === 2) {
        url = new URL(`https://raw.githubusercontent.com/${parts.slice(0, 2).join('/')}/${parts.slice(3).join('/')}`)
        url.search = new URL(value).search
      }
    }

    let response
    try {
      response = await fetch(url, {
        signal: AbortSignal.timeout(15000),
        headers: { Accept: 'text/markdown, text/plain, text/*;q=0.9, */*;q=0.1' },
      })
    } catch (error) {
      if (error.name === 'TimeoutError') throw new Error('Request timed out. Try again.')
      throw new Error('Could not fetch this URL. Check the link and your connection.')
    }
    if (!response.ok) throw new Error(`Request failed: HTTP ${response.status}.`)
    if (!['http:', 'https:'].includes(new URL(response.url).protocol)) {
      throw new Error('The URL redirected to an unsupported address.')
    }

    const maxBytes = 5 * 1024 * 1024
    const declaredSize = Number(response.headers.get('content-length'))
    if (declaredSize > maxBytes) throw new Error('Markdown file is larger than 5 MB.')
    if (!response.body) throw new Error('The URL returned an empty response.')

    const reader = response.body.getReader()
    const chunks = []
    let totalBytes = 0
    while (true) {
      const { done, value: chunk } = await reader.read()
      if (done) break
      totalBytes += chunk.byteLength
      if (totalBytes > maxBytes) {
        await reader.cancel()
        throw new Error('Markdown file is larger than 5 MB.')
      }
      chunks.push(Buffer.from(chunk))
    }

    return { content: Buffer.concat(chunks).toString('utf-8'), url: response.url }
  })

  ipcMain.handle('watch-file', async (_event, filePath) => {
    if (watcher) watcher.close()
    watcher = chokidar.watch(filePath, { persistent: true })
    watcher.on('change', () => {
      if (mainWin && !mainWin.isDestroyed()) {
        mainWin.webContents.send('file-changed')
      }
    })
  })

  ipcMain.handle('get-args', async () => {
    const args = process.argv.slice(1)
    return args.find(a => a.endsWith('.md') || a.endsWith('.markdown')) || null
  })

  ipcMain.handle('renderer-ready', async () => {
    rendererReady = true
    for (const filePath of pendingOpenFiles) {
      if (mainWin && !mainWin.isDestroyed()) mainWin.webContents.send('open-file', filePath)
    }
    pendingOpenFiles = []
  })

  ipcMain.handle('get-theme', async () => {
    return nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
  })

  ipcMain.handle('open-file-dialog', async () => {
    if (!mainWin) return null
    const result = await dialog.showOpenDialog(mainWin, {
      properties: ['openFile'],
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
    })
    if (!result.canceled && result.filePaths.length > 0) {
      const fp = result.filePaths[0]
      addRecent(fp)
      return fp
    }
    return null
  })

  ipcMain.handle('open-file-path', async (_event, filePath) => {
    addRecent(filePath)
    return true
  })

  ipcMain.handle('get-recent-files', async () => {
    return [...recentFiles]
  })

  const prefsPath = path.join(app.getPath('userData'), 'prefs.json')
  ipcMain.handle('load-pref', async () => {
    try { return JSON.parse(fs.readFileSync(prefsPath, 'utf-8')) } catch { return {} }
  })
  ipcMain.handle('save-pref', async (_e, obj) => {
    try {
      const existing = JSON.parse(fs.readFileSync(prefsPath, 'utf-8'))
      fs.writeFileSync(prefsPath, JSON.stringify({ ...existing, ...obj }), 'utf-8')
    } catch { fs.writeFileSync(prefsPath, JSON.stringify(obj), 'utf-8') }
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
    },
  })

  rendererReady = false
  if (pendingOpenFiles.length === 0) {
    const initialPath = process.argv.slice(1).find(a => a.endsWith('.md') || a.endsWith('.markdown'))
    if (initialPath) pendingOpenFiles.push(initialPath)
  }

  const loadPromise = isDev
    ? mainWin.loadURL('http://localhost:5173')
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
  buildMenu()
  setupIPC()
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})
