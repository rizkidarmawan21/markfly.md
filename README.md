# Markfly.md

<!-- ICON: insert image/icon link here -->
<p align="center">
  <!-- <img src="https://github.com/user-attachments/assets/5f81ede5-a77c-4613-9c16-a495f9319b3f" alt="Markfly" width="96" height="96"> -->
  <!-- <img width="100" alt="Minimalist Four-Petal Butterfly Emblem" src="https://github.com/user-attachments/assets/d240ba35-cdc8-40ce-a052-d272d7124db4" /> -->
  <img width="500" alt="Minimal markfly md Logo Banner-modified" src="https://github.com/user-attachments/assets/4161df39-b35d-40b7-a622-ad344204c008" />

</p>

<p align="center"><strong>Minimal, native macOS markdown viewer.</strong></
p>
<p align="center">Open `.md` files from Finder, preview with GitHub-styled
rendering, toggle raw source, auto-reload on file changes.</p>

---

<p align="center">
  <!-- <img width="1619" height="1022" alt="Screenshot at Oct 10 00-22-18" src="https://github.com/user-attachments/assets/292d4e05-2f3c-421c-b0cd-ae2191639876" /> -->

 <!--  <img width="1020" alt="Screenshot at Jul 09 19-53-47-modified" src="https://github.com/user-attachments/assets/c3a7317f-60b4-48c9-bab9-a896b728a335" />  -->
  <img width="1020" alt="Screenshot at Jul 09 19-53-47-modified" src="https://github.com/user-attachments/assets/292d4e05-2f3c-421c-b0cd-ae2191639876" />
</p>

## Features

- **macOS file association** — double-click `.md` in Finder opens in Markfly; right-click > Open With works
- **Rendered preview** — GFM tables, task lists, strikethrough, highlighted code blocks, Mermaid diagrams, and LaTeX math
- **Raw source toggle** — switch between rendered HTML and plain markdown
- **Auto-reload** — watcher re-reads file on disk changes
- **Dark / light theme** — follows system preference, toggle via toolbar
- **Zoom controls** — pinch via Cmd±/Cmd+0, or toolbar buttons
- **Document search** — Cmd+F, highlight matches, move with Enter / Shift+Enter
- **Drag & drop** — drop `.md` files onto the window; original file path stays available after restart
- **Recent files** — macOS Open Recent menu and system recents

## Install

### Option A: PKG (recommended — shows progress & completion)

1. Download `Markfly-<version>-arm64.pkg` from [Releases](../../releases)
2. Double-click the `.pkg` file
3. Follow the standard macOS installer (requires admin password)
4. Launch Markfly from `/Applications`

## In-app updates

Markfly checks GitHub Releases when it starts. Use **Help → Check for Updates…** to check manually. Update status appears at the bottom of the sidebar; **Release Info** opens the GitHub release page separately.

When an update is available, choose **Download Update**, then **Open Installer** after the package is verified. Confirm installation in macOS Installer and reopen Markfly yourself. Markfly does not silently replace or restart the app. This manual flow does not require an Apple Developer account; because releases are not Developer ID signed, macOS may show a security warning or require approval before opening the installer/app. Fully automatic in-app replacement would require Developer ID-signed releases and a separate updater design.

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
| Diagrams          | [Mermaid](https://mermaid.js.org/)                                          |
| Math              | [KaTeX](https://katex.org/)                                                 |
| Theme stylesheet  | [github-markdown-css](https://github.com/sindresorhus/github-markdown-css)  |
| Packaging         | [electron-builder](https://www.electron.build/)                             |
| File watcher      | [chokidar](https://github.com/paulmillr/chokidar)                           |
