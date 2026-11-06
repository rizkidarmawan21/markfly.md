# Markfly native release design

Markfly opens Markdown from Finder, lets readers edit an individual GFM table, and exports the active document to PDF or Word. An AppKit shell owns native windows, menus, file access, watch events, pasteboard, and export destinations. WKWebView uses the existing Vue and Markdown renderer from a private bundle origin.

The shell validates bridge messages and only accepts paths granted by a native open action, trusted session migration, or native drop. Keep Electron available as the rollback build during qualification. Preserve tabs, theme, zoom, source toggle, search, math, Mermaid controls, and the local file association. Remote Markdown keeps the existing network and resource restrictions. Writes check for concurrent file changes and update only the selected GFM table. Existing Markdown remains the canonical format.

PDF uses the rendered document with A4 or Letter pagination, selectable text, and bounded layouts for large tables and diagrams. Word uses Pandoc, converting rendered diagrams to embedded images and keeping tables and supported math editable. The helper is optional, verified, and works offline once installed. Users pick the output path through the system save panel.

Qualify a Developer ID signed and notarized DMG on a fresh Mac. Verify existing user state, representative long PDFs, and DOCX layout in Word. Compare package size, Finder-to-render latency, and idle RAM with v0.4.3 before promoting the native build.
