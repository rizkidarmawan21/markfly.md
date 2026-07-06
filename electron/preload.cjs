const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  readFile: (path) => ipcRenderer.invoke('read-file', path),
  watchFile: (path) => ipcRenderer.invoke('watch-file', path),
  getArgs: () => ipcRenderer.invoke('get-args'),
  getTheme: () => ipcRenderer.invoke('get-theme'),
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  openFilePath: (path) => ipcRenderer.invoke('open-file-path', path),
  getRecentFiles: () => ipcRenderer.invoke('get-recent-files'),
  onFileChanged: (cb) => {
    const handler = () => cb()
    ipcRenderer.on('file-changed', handler)
    return () => ipcRenderer.removeListener('file-changed', handler)
  },
  onOpenFile: (cb) => {
    const handler = (_event, path) => cb(path)
    ipcRenderer.on('open-file', handler)
    return () => ipcRenderer.removeListener('open-file', handler)
  },
})
