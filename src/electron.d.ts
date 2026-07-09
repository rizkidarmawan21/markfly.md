interface TabItem {
  path: string
  name: string
  active?: boolean
}

interface Panel {
  id: string
  path: string | null
  zoom: number
  showRaw: boolean
}

interface PanelLayout {
  panels: Panel[]
  cols: number
  rows: number
}

interface ElectronAPI {
  readFile(path: string): Promise<string>
  watchFile(path: string): Promise<void>
  getArgs(): Promise<string | null>
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
