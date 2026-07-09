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

  // Panel header should show filename (in panel header specifically)
  await expect(page.locator('.panel-header span')).toHaveText('readme.md')

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

  // Header should show just the filename, not full path
  await expect(page.locator('text=my-doc.md')).toBeVisible()
})
