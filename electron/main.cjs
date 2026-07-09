const { app, BrowserWindow, ipcMain, nativeTheme, Menu, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const chokidar = require('chokidar')

let mainWin
let watcher = null
let pendingOpenFile = null  // macOS open-file can fire before ready — queue it
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
  mainWin.webContents.send('open-file', filePath)
  mainWin.focus()
}

// --- IPC handlers ---
function setupIPC() {
  ipcMain.handle('read-file', async (_event, filePath) => {
    try { return fs.readFileSync(filePath, 'utf-8') } catch { return null }
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
    return pendingOpenFile || args.find(a => a.endsWith('.md') || a.endsWith('.markdown')) || null
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

  const loadPromise = isDev
    ? mainWin.loadURL('http://localhost:5173')
    : mainWin.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))

  loadPromise.then(() => {
    if (pendingOpenFile) {
      openFile(pendingOpenFile)
      pendingOpenFile = null
    }
  })
}

// Register at module level — macOS open-file fires before ready
app.on('open-file', (event, filePath) => {
  event.preventDefault()
  if (mainWin && !mainWin.isDestroyed()) {
    openFile(filePath)
  } else {
    pendingOpenFile = filePath
    if (!mainWin || mainWin.isDestroyed()) {
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
    if (pendingOpenFile) {
      openFile(pendingOpenFile)
      pendingOpenFile = null
    }
  }
})
