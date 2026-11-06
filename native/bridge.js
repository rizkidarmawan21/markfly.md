(() => {
  const handlers = new Map()
  const invoke = (method, ...args) => window.webkit.messageHandlers.markfly.postMessage({ method, args })

  function subscribe(name, callback) {
    let callbacks = handlers.get(name)
    if (!callbacks) handlers.set(name, callbacks = new Set())
    callbacks.add(callback)
    return () => callbacks.delete(callback)
  }

  Object.defineProperty(window, '__markflyEvent', {
    value: (name, value) => {
      for (const callback of handlers.get(name) || []) callback(value)
    },
  })

  Object.defineProperty(window, 'electronAPI', {
    value: Object.freeze({
      readFile: path => invoke('readFile', path),
      copyText: text => invoke('copyText', text),
      fetchMarkdownUrl: url => invoke('fetchMarkdownUrl', url),
      watchFile: path => invoke('watchFile', path),
      getArgs: () => invoke('getArgs'),
      rendererReady: () => invoke('rendererReady'),
      openDroppedFile: async () => { throw new Error('Drop a Markdown file from Finder.') },
      openExternal: url => invoke('openExternal', url),
      getUpdateState: () => invoke('getUpdateState'),
      checkForUpdates: () => invoke('checkForUpdates'),
      downloadUpdate: () => invoke('getUpdateState'),
      openUpdateInstaller: () => invoke('getUpdateState'),
      openUpdateRelease: () => invoke('openUpdateRelease'),
      onUpdateState: callback => subscribe('update-state', callback),
      getTheme: () => invoke('getTheme'),
      openFileDialog: () => invoke('openFileDialog'),
      openFilePath: path => invoke('openFilePath', path),
      getRecentFiles: () => invoke('getRecentFiles'),
      onFileChanged: callback => subscribe('file-changed', callback),
      onOpenFile: callback => subscribe('open-file', callback),
      loadPref: () => invoke('loadPref'),
      savePref: prefs => invoke('savePref', prefs),
      saveTable: (path, expected, next) => invoke('saveTable', path, expected, next),
      exportPDF: (name, html, pageSize) => invoke('exportPDF', name, html, pageSize),
      exportWord: (name, markdown, images) => invoke('exportWord', name, markdown, images),
    }),
  })
})()
