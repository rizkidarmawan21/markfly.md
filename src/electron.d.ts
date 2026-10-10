interface TabItem {
  path: string
  name: string
  active?: boolean
}

type UpdateStatus = 'idle' | 'checking' | 'current' | 'available' | 'downloading' | 'ready' | 'opening' | 'error'

interface UpdateState {
  revision: number
  status: UpdateStatus
  currentVersion: string
  latestVersion: string | null
  releaseInfoAvailable: boolean
  bytesReceived: number
  totalBytes: number | null
  error: string | null
}

interface ElectronAPI {
  readFile(path: string): Promise<string | null>
  copyText(text: string): Promise<boolean>
  fetchMarkdownUrl(url: string): Promise<{ content: string; url: string }>
  watchFile(path: string): Promise<void>
  getArgs(): Promise<string | null>
  rendererReady(): Promise<void>
  openDroppedFile(file: File): Promise<{ path: string; content: string }>
  openExternal(url: string): Promise<boolean>
  getUpdateState(): Promise<UpdateState>
  checkForUpdates(): Promise<UpdateState>
  downloadUpdate(): Promise<UpdateState>
  openUpdateInstaller(): Promise<UpdateState>
  openUpdateRelease(): Promise<void>
  onUpdateState(cb: (state: UpdateState) => void): () => void
  getTheme(): Promise<'light' | 'dark'>
  openFileDialog(): Promise<string | null>
  openFilePath(path: string): Promise<boolean>
  getRecentFiles(): Promise<string[]>
  onFileChanged(cb: () => void): () => void
  onOpenFile(cb: (path: string) => void): () => void
  loadPref(): Promise<Record<string, unknown>>
  savePref(obj: Record<string, unknown>): Promise<void>
}

interface Window {
  electronAPI: ElectronAPI
}
