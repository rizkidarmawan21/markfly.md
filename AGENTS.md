# Markfly — Agent Guide

## About

Minimal macOS markdown viewer. Open `.md` files from Finder, preview with GitHub-styled rendering, toggle raw source, auto-reload on file changes.

## Features

- macOS file association — double-click `.md` opens in Markfly; right-click > Open With
- GitHub-themed rendered preview (light & dark), syntax-highlighted code blocks
- Raw source toggle (toolbar button)
- Auto-reload on file changes (chokidar watcher)
- Dark/light theme (follows system, persisted per session toggle)
- Zoom controls (Cmd± / Cmd+0, toolbar buttons)
- Drag & drop `.md` files
- Recent files (macOS Open Recent menu)

## Tech Stack

| Layer | Tech |
|-------|------|
| Desktop shell | Electron 43 |
| UI | Vue 3 + TypeScript |
| Build | Vite 8 |
| CSS | Tailwind CSS v4 |
| Markdown renderer | marked v18 |
| Syntax highlight | highlight.js |
| Theme stylesheet | github-markdown-css v5 |
| Packaging | electron-builder v26 |
| File watcher | chokidar |

## Project Structure

```
/
├── electron/
│   ├── main.cjs         # Electron main process (window, IPC, menu, file watcher)
│   └── preload.cjs      # Context bridge (exposes API to renderer)
├── src/
│   ├── App.vue          # Root component (layout, toolbar, markdown viewer)
│   ├── main.ts          # Vue app entry
│   ├── style.css        # Tailwind + custom overrides (list markers, scrollbar)
│   ├── electron.d.ts    # TypeScript declarations for window.electronAPI
│   ├── assets/          # Static assets (currently empty)
│   └── components/      # Vue components (currently empty)
├── build/
│   └── icon.png         # App icon (electron-builder auto-converts)
├── dist/                # Vite build output (gitignored)
├── release/             # electron-builder output (DMG, PKG, ZIP — gitignored)
├── index.html           # Vite entry HTML
├── vite.config.ts       # Vite config (Vue + Tailwind plugins, strictPort)
├── electron-builder.yml # electron-builder config (macOS targets, file associations)
├── tsconfig.json        # TS project references
├── tsconfig.app.json    # TS config for src/
├── tsconfig.node.json   # TS config for vite config
├── package.json         # Deps, scripts
└── AGENTS.md            # This file
```

## Architecture

### Process model (Electron)

- **Main process** (`electron/main.cjs`): window management, IPC handlers, native menu, file system ops, chokidar watcher
- **Renderer process** (`src/`): Vue 3 SPA, loaded via Vite dev server (`localhost:5173`) or `dist/index.html`
- **Preload** (`electron/preload.cjs`): contextBridge exposing `window.electronAPI` with typed methods

### Key flows

1. **Open file from Finder:** macOS `open-file` event → main process queues path → `createWindow` → renderer `onMounted` calls `getArgs` → loads file content → renders via `marked`
2. **Open via dialog:** renderer `openFile()` → IPC `open-file-dialog` → main shows dialog → returns path → renderer reads + renders
3. **File watch:** after loading, main calls `chokidar.watch(path)` → on change → IPC `file-changed` → renderer reloads content
4. **Theme toggle:** renderer toggles `isDark` ref → toggles `.dark` class + hljs/md stylesheets → persists via IPC `savePref` to `userData/prefs.json`

## IPC API (window.electronAPI)

| Method | Type | Description |
|--------|------|-------------|
| `readFile(path)` | `Promise<string>` | Read file contents |
| `watchFile(path)` | `Promise<void>` | Start watching file for changes |
| `getArgs()` | `Promise<string\|null>` | Get file path from CLI args or pending open-file |
| `getTheme()` | `Promise<'light'\|'dark'>` | Get native theme |
| `openFileDialog()` | `Promise<string\|null>` | Show native open dialog |
| `openFilePath(path)` | `Promise<boolean>` | Add path to recent files |
| `getRecentFiles()` | `Promise<string[]>` | Get recent files list |
| `loadPref()` | `Promise<Record<string, unknown>>` | Load persisted preferences |
| `savePref(obj)` | `Promise<void>` | Save preferences |

## Code Style

### Vue (`*.vue`)

- `<script setup lang="ts">` composition API
- `ref` / `computed` for state; no Options API
- Template uses kebab-case for HTML, camelCase for JS
- Single root component (`App.vue`) — no routing
- Arrow functions for event handlers

### TypeScript

- Strict: `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`
- `erasableSyntaxOnly` — no enums, no namespaces, no parameter properties
- `types: ["vite/client"]` for Vite env types
- `allowArbitraryExtensions: true` for `.css?url` imports

### CSS

- Tailwind utility classes preferred over custom CSS
- Custom CSS only for overrides (github-markdown-css list markers, scrollbar, fullscreen)
- `@custom-variant dark` for `.dark` class-based dark mode
- No PostCSS config (Vite handles via `@tailwindcss/vite`)

### Electron (main.cjs)

- CommonJS (plain `require`, no ESM)
- `async/await` for IPC handlers
- `try/catch` for IPC handlers (silent best-effort for prefs)

## Package scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Vite dev server (hot reload) |
| `npm run build` | TypeScript check + Vite build |
| `npm run electron:dev` | Vite + Electron concurrently |
| `npm run electron:build` | Build + package with electron-builder |

## Linting

- TypeScript strict checks via `vue-tsc` (run as part of `npm run build`)
- ESLint: not configured (add if needed)
- Stylelint: not configured

## Testing

No test framework installed. Test manually:

1. `npm run electron:dev` — dev mode with hot reload
2. `npm run electron:build` — package and install DMG/PKG
3. Test macOS file association: double-click `.md` in Finder
4. Test theme persistence: toggle, close app, reopen

## Build

```bash
npm run electron:build
```

Output in `release/`:

- `Markfly-<version>-arm64.dmg` — drag-drop install
- `Markfly-<version>-arm64.pkg` — installer with progress notification
- `Markfly-<version>-arm64-mac.zip` — portable archive

Build config in `electron-builder.yml`. Key settings:

- `files: [dist/**/*, electron/**/*, package.json]` — only ships needed files
- `CFBundleDocumentTypes` — registers `.md`/`.markdown` file association
- PKG + DMG + ZIP targets

## Best Practices

- **No global state:** single Vue root, no Pinia/Vuex
- **Minimal deps:** only `chokidar` in `dependencies` (runtime); everything else devDeps (Vite-bundled)
- **YAGNI:** no router, no test framework, no store — add only when needed
- **Theme persistence:** JSON in `userData/prefs.json` — no `electron-store` dep
- **File watcher:** single chokidar instance, cleaned between files
- **macOS integration:** `open-file` event at module level (not inside createWindow) to catch early events
- **Context isolation:** `contextIsolation: true`, `nodeIntegration: false` — all bridge via preload
