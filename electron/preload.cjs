const { contextBridge, ipcRenderer, webUtils } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  readFile: (path) => ipcRenderer.invoke('read-file', path),
  copyText: (text) => ipcRenderer.invoke('copy-text', text),
  fetchMarkdownUrl: (url) => ipcRenderer.invoke('fetch-markdown-url', url),
  watchFile: (path) => ipcRenderer.invoke('watch-file', path),
  getArgs: () => ipcRenderer.invoke('get-args'),
  rendererReady: () => ipcRenderer.invoke('renderer-ready'),
  openDroppedFile: (file) => {
    const path = webUtils.getPathForFile(file)
    return ipcRenderer.invoke('open-dropped-file', path)
  },
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
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
  loadPref: () => ipcRenderer.invoke('load-pref'),
  savePref: (obj) => ipcRenderer.invoke('save-pref', obj),
})
