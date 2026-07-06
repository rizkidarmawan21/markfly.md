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
}

interface Window {
  electronAPI: ElectronAPI
}
