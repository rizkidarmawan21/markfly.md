# Markfly.md

<!-- ICON: insert image/icon link here -->
<p align="center">
  <img src="build/icon.png" alt="Markfly" width="96" height="96">
</p>

<p align="center"><strong>Minimal, native macOS markdown viewer.</strong></
p>
<p align="center">Open `.md` files from Finder, preview with GitHub-styled
rendering, toggle raw source, auto-reload on file changes.</p>

---

## Features

- **macOS file association** — double-click `.md` in Finder opens in Markfly; right-click > Open With works
- **Rendered preview** — GitHub-themed markdown (light & dark), syntax-highlighted code blocks
- **Raw source toggle** — switch between rendered HTML and plain markdown
- **Auto-reload** — watcher re-reads file on disk changes
- **Dark / light theme** — follows system preference, toggle via toolbar
- **Zoom controls** — pinch via Cmd±/Cmd+0, or toolbar buttons
- **Drag & drop** — drop `.md` files onto the window
- **Recent files** — macOS Open Recent menu and system recents

## Install

### Option A: PKG (recommended — shows progress & completion)

1. Download `Markfly-<version>-arm64.pkg` from [Releases](../../releases)
2. Double-click the `.pkg` file
3. Follow the standard macOS installer (requires admin password)
4. Launch Markfly from `/Applications`

### Option B: DMG (drag-drop, no password)

1. Download `Markfly-<version>-arm64.dmg` from [Releases](../../releases)
2. Double-click the `.dmg` file
3. Drag `Markfly.app` into `/Applications`
4. Launch Markfly from `/Applications`

## Dev

```bash
# install
npm install

# dev (Vite hot-reload + Electron)
npm run electron:dev

# build production
npm run electron:build
```

Output in `release/` — `.dmg`, `.pkg`, and `.zip`.

## Tech Stack

| Layer             | Tech                                                                        |
| ----------------- | --------------------------------------------------------------------------- |
| Desktop shell     | [Electron](https://www.electronjs.org/)                                     |
| UI                | [Vue 3](https://vuejs.org/) + [TypeScript](https://www.typescriptlang.org/) |
| Build             | [Vite](https://vitejs.dev/)                                                 |
| CSS               | [Tailwind CSS v4](https://tailwindcss.com/)                                 |
| Markdown renderer | [marked](https://marked.js.org/) v18                                        |
| Syntax highlight  | [highlight.js](https://highlightjs.org/)                                    |
| Theme stylesheet  | [github-markdown-css](https://github.com/sindresorhus/github-markdown-css)  |
| Packaging         | [electron-builder](https://www.electron.build/)                             |
| File watcher      | [chokidar](https://github.com/paulmillr/chokidar)                           |
