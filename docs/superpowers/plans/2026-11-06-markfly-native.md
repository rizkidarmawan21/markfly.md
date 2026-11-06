# Markfly Native Implementation Plan

> **For agentic workers:** Use parallel agents for independent subsystems and integrate against the interfaces below.

**Goal:** Prepare an AppKit build with existing reader behavior, visual GFM table edits, and local PDF and Word export.

**Architecture:** Build the Vue renderer with Vite and bundle its generated assets inside the AppKit app. Keep file authorization, write conflicts, helper execution, and save dialogs in the native process.

**Tech stack:** Swift, AppKit, WebKit, PDFKit, Vue, Vite, Marked, Mermaid, KaTeX, and optional Pandoc.

## Shared contracts

- The native bridge exposes the existing renderer interface. Operations are validated in the host. New methods are `saveTable(path, expected, next)`, `exportPDF(name, html, pageSize)`, and `exportWord(name, markdown, images)`.
- Native export entry points are `PDFExporter.save(name:html:pageSize:)` and `WordExporter.save(name:markdown:images:)`, both async and throwing. The host owns routing and menu events. Export code consumes snapshots and never saves the source Markdown.
- `src/App.vue` connects the active document and dispatches export from a document menu after the table work lands. Keep Electron tests and packaging usable during migration.
- Match the Electron release's authorized file, renderer origin, input limits, and safe URL behavior. Publish only after local parity and distribution checks.

## Work and verification

- [x] Native shell in `native/`. Bundle Vite output, grant access from AppKit open and drop, restore trusted state, watch saves and replacements, and qualify bridge origins. Run packaged smoke with synthetic data and test stale and unauthorized writes.
- [x] Visual tables in `src/App.vue`, `src/components/TableEditor.vue`, and `src/markdown-tables.ts`. Test escaped pipes, mixed line endings, duplicate and nested tables, undo, focus, and source preservation. Use the native save contract to reject concurrent edits.
- [x] PDF in `native/PDFExporter.swift` and `src/pdf-export.ts`. Reproduce the single-page WebKit output with a long fixture before implementing pagination. Inspect pages for A4 and Letter, end marker, clipping, and selectable text.
- [x] Word in `native/WordExporter.swift` and `src/docx-export.ts`. Use a pinned optional helper and the current document snapshot. Inspect OOXML for editable tables and formulas and an embedded diagram. The generated DOCX passed structural checks. Open the output in Word before release qualification.
- [ ] Build and distribution with `scripts/build-native.sh` and `native/Info.plist`. Verify arm64 package contents and association. Compare against v0.4.3, then sign, notarize, and test a downloaded DMG on a clean Mac.

Local verification passed on macOS arm64. Distribution remains gated on Developer ID signing and notarization, fresh-Mac installation and performance checks, and layout verification in Microsoft Word.
