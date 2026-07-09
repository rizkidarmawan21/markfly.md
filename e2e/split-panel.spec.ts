import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  // Mock electronAPI before navigating
  await page.addInitScript(() => {
    const noop = () => {}
    window.electronAPI = {
      readFile: async (path: string) => '# Hello World\n\nThis is a **test** markdown.',
      watchFile: async () => {},
      getArgs: async () => null,
      getTheme: async () => 'light',
      openFileDialog: async () => null,
      openFilePath: async () => true,
      getRecentFiles: async () => [],
      onFileChanged: () => noop,
      onOpenFile: () => noop,
      loadPref: async () => ({}),
      savePref: async () => {},
    }
  })
})

test('renders PanelGrid with one panel', async ({ page }) => {
  await page.goto('http://localhost:5173')

  // Header should show Markfly
  await expect(page.locator('text=Markfly')).toBeVisible()

  // Sidebar toggle button should be present
  await expect(page.locator('button[title="Toggle Sidebar"]')).toBeVisible()

  // Panel should show empty state initially
  await expect(page.locator('text=Drop .md here or click to open')).toBeVisible()
})

test('click empty panel -> openFile dialog -> panel shows content', async ({ page }) => {
  // Override openFileDialog to return a path, simulating user selecting a file
  await page.addInitScript(() => {
    window.electronAPI.openFileDialog = async () => '/Users/test/document.md'
  })

  await page.goto('http://localhost:5173')

  await page.locator('text=Drop .md here or click to open').click()
  await page.waitForTimeout(500)

  // Tab bar should show document.md
  await expect(page.locator('.tab-bar').first()).toBeVisible()
  // Content should be rendered (markdown-body)
  await expect(page.locator('.markdown-body')).toBeVisible()
})

test('panel shows file content when path is set', async ({ page }) => {
  // Inject pref with a file already open
  await page.addInitScript(() => {
    window.electronAPI = {
      readFile: async (path: string) => '# Hello World\n\nThis is a **test** markdown.',
      watchFile: async () => {},
      getArgs: async () => null,
      getTheme: async () => 'light',
      openFileDialog: async () => null,
      openFilePath: async () => true,
      getRecentFiles: async () => [],
      onFileChanged: () => {},
      onOpenFile: () => {},
      loadPref: async () => ({
        tabs: [{ path: '/test/readme.md', active: true }],
        activePath: '/test/readme.md',
        panelLayout: {
          cols: 1,
          rows: 1,
          panels: [{ id: 'p1', path: '/test/readme.md', zoom: 1, showRaw: false }],
        },
      }),
      savePref: async () => {},
    }
  })

  await page.goto('http://localhost:5173')

  // Wait for render
  await page.waitForTimeout(1000)

  // Tab bar shows readme.md
  await expect(page.locator('.tab-bar')).toContainText('readme.md')

  // Panel should render markdown (the markdown-body article)
  const markdownBody = page.locator('.markdown-body')
  await expect(markdownBody).toBeVisible()

  // Should contain rendered HTML from markdown
  await expect(markdownBody.locator('h1')).toContainText('Hello World')
})

test('split vertical creates two panels', async ({ page }) => {
  await page.addInitScript(() => {
    window.electronAPI = {
      readFile: async () => '# test',
      watchFile: async () => {},
      getArgs: async () => null,
      getTheme: async () => 'light',
      openFileDialog: async () => null,
      openFilePath: async () => true,
      getRecentFiles: async () => [],
      onFileChanged: () => {},
      onOpenFile: () => {},
      loadPref: async () => ({
        panelLayout: {
          cols: 2,
          rows: 1,
          panels: [
            { id: 'p1', path: null, zoom: 1, showRaw: false },
            { id: 'p2', path: null, zoom: 1, showRaw: false },
          ],
        },
      }),
      savePref: async () => {},
    }
  })

  await page.goto('http://localhost:5173')

  // Should see two empty panels
  const dropZones = page.locator('text=Drop .md here or click to open')
  await expect(dropZones).toHaveCount(2)
})

test('select from sidebar assigns path to panel', async ({ page }) => {
  await page.addInitScript(() => {
    window.electronAPI = {
      readFile: async (path: string) => '# Sidebar doc\n\nSelected from sidebar.',
      watchFile: async () => {},
      getArgs: async () => null,
      getTheme: async () => 'light',
      openFileDialog: async () => null,
      openFilePath: async () => true,
      getRecentFiles: async () => [],
      onFileChanged: () => {},
      onOpenFile: () => {},
      loadPref: async () => ({
        tabs: [{ path: '/test/sidebar-doc.md', active: true }],
        activePath: '/test/sidebar-doc.md',
        panelLayout: { cols: 1, rows: 1, panels: [{ id: 'p1', path: '/test/sidebar-doc.md', zoom: 1, showRaw: false }] },
      }),
      savePref: async () => {},
    }
  })

  await page.goto('http://localhost:5173')
  await page.waitForTimeout(500)

  // Tab bar shows filename
  await expect(page.locator('.tab-bar')).toContainText('sidebar-doc.md')
  // Markdown body renders
  await expect(page.locator('.markdown-body')).toBeVisible()
  await expect(page.locator('.markdown-body h1')).toContainText('Sidebar doc')
})

test('panel header shows filename', async ({ page }) => {
  await page.addInitScript(() => {
    window.electronAPI = {
      readFile: async () => '# test',
      watchFile: async () => {},
      getArgs: async () => null,
      getTheme: async () => 'light',
      openFileDialog: async () => null,
      openFilePath: async () => true,
      getRecentFiles: async () => [],
      onFileChanged: () => {},
      onOpenFile: () => {},
      loadPref: async () => ({
        tabs: [{ path: '/Users/test/my-doc.md', active: true }],
        activePath: '/Users/test/my-doc.md',
        panelLayout: {
          cols: 1,
          rows: 1,
          panels: [{ id: 'p1', path: '/Users/test/my-doc.md', zoom: 1, showRaw: false }],
        },
      }),
      savePref: async () => {},
    }
  })

  await page.goto('http://localhost:5173')

  // Tab bar shows filename
  await expect(page.locator('.tab-bar')).toContainText('my-doc.md')
})
