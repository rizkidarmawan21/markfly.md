import AppKit
import UniformTypeIdentifiers
import WebKit

@MainActor
final class MarkflyWebView: WKWebView {
    var onDrop: ((URL) -> Void)?

    private func droppedURLs(_ sender: NSDraggingInfo) -> [URL] {
        sender.draggingPasteboard.readObjects(forClasses: [NSURL.self],
                                               options: [.urlReadingFileURLsOnly: true]) as? [URL] ?? []
    }

    override func draggingEntered(_ sender: NSDraggingInfo) -> NSDragOperation {
        dropOperation(sender)
    }

    override func draggingUpdated(_ sender: NSDraggingInfo) -> NSDragOperation {
        dropOperation(sender)
    }

    override func prepareForDragOperation(_ sender: NSDraggingInfo) -> Bool {
        dropOperation(sender) == .copy
    }

    override func performDragOperation(_ sender: NSDraggingInfo) -> Bool {
        guard let url = droppedURLs(sender).first(where: MarkdownFiles.isMarkdown) else { return false }
        onDrop?(url)
        return true
    }

    private func dropOperation(_ sender: NSDraggingInfo) -> NSDragOperation {
        droppedURLs(sender).contains(where: MarkdownFiles.isMarkdown) ? .copy : []
    }
}

@main
@MainActor
final class MarkflyApp: NSObject, NSApplicationDelegate, NSWindowDelegate,
                        WKNavigationDelegate, WKScriptMessageHandlerWithReply {
    private let files = MarkdownFiles()
    private lazy var watcher = FileWatcher { [weak self] in self?.send("file-changed") }
    private lazy var updater = UpdateCheck(version: version) { [weak self] in self?.send("update-state", $0) }
    private let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "0.0.0"
    private let recentMenu = NSMenu(title: "Open Recent")

    private var window: NSWindow?
    private var webView: MarkflyWebView?
    private var ready = false
    private var launched = false
    private var initialArgument: String?
    private var pendingFiles: [String] = []
    private var openPanel: NSOpenPanel?
    private var exporting = false

    static func main() {
        let app = NSApplication.shared
        let delegate = MarkflyApp()
        app.delegate = delegate
        app.setActivationPolicy(.regular)
        withExtendedLifetime(delegate) { app.run() }
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        launched = true
        if let argument = CommandLine.arguments.dropFirst()
            .map({ URL(fileURLWithPath: $0) }).first(where: MarkdownFiles.isMarkdown) {
            initialArgument = try? files.authorize(argument)
        }
        installMenus()
        showWindow()
    }

    func application(_ application: NSApplication, open urls: [URL]) {
        for url in urls { openDocument(url) }
    }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows: Bool) -> Bool {
        if !hasVisibleWindows { showWindow() }
        return true
    }

    func windowWillClose(_ notification: Notification) {
        guard notification.object as? NSWindow === window else { return }
        ready = false
        watcher.stop()
        webView?.configuration.userContentController.removeScriptMessageHandler(forName: "markfly", contentWorld: .page)
        webView = nil
        window = nil
    }

    private func showWindow() {
        if let window {
            window.makeKeyAndOrderFront(nil)
            NSApp.activate(ignoringOtherApps: true)
            return
        }

        guard let resources = Bundle.main.resourceURL,
              let bridge = try? String(contentsOf: resources.appendingPathComponent("bridge.js"), encoding: .utf8)
        else {
            let alert = NSAlert()
            alert.messageText = "Markfly’s resources are missing."
            alert.informativeText = "Rebuild or reinstall the application."
            alert.runModal()
            NSApp.terminate(nil)
            return
        }

        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .nonPersistent()
        configuration.setURLSchemeHandler(BundleScheme(resources: resources), forURLScheme: BundleScheme.name)
        configuration.userContentController.addScriptMessageHandler(self, contentWorld: .page, name: "markfly")
        configuration.userContentController.addUserScript(WKUserScript(source: bridge,
            injectionTime: .atDocumentStart, forMainFrameOnly: true, in: .page))

        let webView = MarkflyWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = self
        webView.registerForDraggedTypes([.fileURL])
        webView.onDrop = { [weak self] in self?.openDocument($0) }
        self.webView = webView

        let window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 900, height: 700),
                              styleMask: [.titled, .closable, .miniaturizable, .resizable],
                              backing: .buffered, defer: false)
        window.isReleasedWhenClosed = false
        window.title = "Markfly v\(version)"
        window.minSize = NSSize(width: 500, height: 400)
        window.delegate = self
        window.contentView = webView
        self.window = window
        window.center()
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        webView.load(URLRequest(url: BundleScheme.entry))
    }

    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction) async -> WKNavigationActionPolicy {
        action.targetFrame?.isMainFrame == true && action.request.url == BundleScheme.entry ? .allow : .cancel
    }

    func webView(_ webView: WKWebView, decidePolicyFor response: WKNavigationResponse) async -> WKNavigationResponsePolicy {
        response.isForMainFrame && response.response.url == BundleScheme.entry ? .allow : .cancel
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        ready = false
        webView.load(URLRequest(url: BundleScheme.entry))
    }

    func userContentController(_ userContentController: WKUserContentController,
                               didReceive message: WKScriptMessage,
                               replyHandler: @escaping (Any?, String?) -> Void) {
        let frame = message.frameInfo
        guard message.webView === webView, frame.isMainFrame,
              frame.request.url == BundleScheme.entry, webView?.url == BundleScheme.entry,
              let body = message.body as? [String: Any],
              let method = body["method"] as? String, let args = body["args"] as? [Any]
        else {
            replyHandler(nil, "Blocked request from an untrusted renderer.")
            return
        }

        Task {
            do { replyHandler(try await handle(method, args), nil) }
            catch { replyHandler(nil, error.localizedDescription) }
        }
    }

    private func handle(_ method: String, _ args: [Any]) async throws -> Any {
        func string(_ index: Int = 0) throws -> String {
            guard args.indices.contains(index), let value = args[index] as? String else {
                throw MarkflyError("Invalid argument for \(method).")
            }
            return value
        }

        switch method {
        case "readFile": return try files.read(string())
        case "copyText":
            let text = try string()
            NSPasteboard.general.clearContents()
            return NSPasteboard.general.setString(text, forType: .string)
        case "fetchMarkdownUrl":
            let document = try await RemoteHTTPS.markdown(string())
            return ["content": document.content, "url": document.url]
        case "watchFile":
            watcher.watch(try files.watchURL(string()))
            return NSNull()
        case "getArgs":
            let argument = initialArgument
            initialArgument = nil
            return argument.map { $0 as Any } ?? NSNull()
        case "rendererReady":
            ready = true
            for path in pendingFiles { send("open-file", path) }
            pendingFiles.removeAll()
            return NSNull()
        case "getTheme":
            return NSApp.effectiveAppearance.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua ? "dark" : "light"
        case "openFileDialog":
            return try await chooseDocument().map { $0 as Any } ?? NSNull()
        case "openFilePath":
            try recordRecent(string())
            return true
        case "getRecentFiles": return files.recent
        case "openExternal":
            guard let url = RemoteHTTPS.safeURL(try string()) else {
                throw MarkflyError("Only safe HTTPS links can be opened.")
            }
            return NSWorkspace.shared.open(url)
        case "loadPref": return files.loadPreferences()
        case "savePref":
            guard let value = args.first as? [String: Any] else { throw MarkflyError("Invalid preferences.") }
            try files.savePreferences(value)
            return NSNull()
        case "saveTable":
            return try files.save(string(), expected: string(1), next: string(2))
        case "exportPDF":
            guard !exporting else { return false }
            exporting = true
            defer { exporting = false }
            return try await PDFExporter.save(name: string(), html: string(1), pageSize: string(2))
        case "exportWord":
            guard !exporting else { return false }
            guard args.indices.contains(2), let images = args[2] as? [String: String] else {
                throw MarkflyError("Invalid Word export images.")
            }
            exporting = true
            defer { exporting = false }
            return try await WordExporter.save(name: string(), markdown: string(1), images: images)
        case "getUpdateState": return updater.state
        case "checkForUpdates": return await updater.check()
        case "openUpdateRelease":
            updater.openRelease()
            return NSNull()
        default: throw MarkflyError("Unknown Markfly bridge operation.")
        }
    }

    private func chooseDocument() async throws -> String? {
        guard let window, openPanel == nil else { return nil }
        let panel = NSOpenPanel()
        panel.allowedContentTypes = ["md", "markdown", "mdown", "markdn"].compactMap { UTType(filenameExtension: $0) }
        openPanel = panel
        defer { openPanel = nil }
        guard await panel.beginSheetModal(for: window) == .OK, let url = panel.url else { return nil }
        let path = try files.authorize(url)
        try recordRecent(path)
        return path
    }

    private func openDocument(_ url: URL) {
        guard let path = try? files.authorize(url) else { return }
        try? recordRecent(path)
        if launched { showWindow() }
        if ready { send("open-file", path) }
        else { pendingFiles.append(path) }
    }

    private func recordRecent(_ path: String) throws {
        try files.recordRecent(path)
        refreshRecent()
    }

    private func send(_ name: String, _ value: Any = NSNull()) {
        webView?.callAsyncJavaScript("window.__markflyEvent(name, value)", arguments: ["name": name, "value": value],
                                     in: nil, in: .page, completionHandler: nil)
    }

    @objc private func openFromMenu() {
        showWindow()
        Task {
            if let path = try? await chooseDocument() {
                if ready { send("open-file", path) }
                else { pendingFiles.append(path) }
            }
        }
    }

    @objc private func openRecent(_ item: NSMenuItem) {
        if let url = item.representedObject as? URL { openDocument(url) }
    }

    @objc private func exportFromMenu(_ item: NSMenuItem) {
        guard ready, let format = item.representedObject as? String else { return }
        webView?.callAsyncJavaScript("window.dispatchEvent(new CustomEvent('markfly-export', { detail: format }))",
                                     arguments: ["format": format], in: nil, in: .page, completionHandler: nil)
    }

    @objc private func findFromMenu() {
        guard ready else { return }
        webView?.evaluateJavaScript("window.dispatchEvent(new KeyboardEvent('keydown', {key:'f', metaKey:true}))",
                                    completionHandler: nil)
    }

    @objc private func checkForUpdates() {
        Task {
            let state = await updater.check()
            let alert = NSAlert()
            if state["status"] as? String == "available", let latest = state["latestVersion"] as? String {
                alert.messageText = "Markfly \(latest) is available."
                alert.informativeText = "View release details on GitHub."
                alert.addButton(withTitle: "Release Details")
                alert.addButton(withTitle: "Close")
                if alert.runModal() == .alertFirstButtonReturn { updater.openRelease() }
            } else {
                alert.messageText = state["status"] as? String == "current" ? "Markfly is up to date." : "Unable to check for updates."
                alert.informativeText = state["error"] as? String ?? ""
                alert.runModal()
            }
        }
    }

    private func refreshRecent() {
        recentMenu.removeAllItems()
        let recent = files.recordsSystemRecents
            ? Array(NSDocumentController.shared.recentDocumentURLs.prefix(10))
            : files.recent.map { URL(fileURLWithPath: $0) }
        if recent.isEmpty {
            let item = NSMenuItem(title: "No Recent Files", action: nil, keyEquivalent: "")
            item.isEnabled = false
            recentMenu.addItem(item)
        } else {
            for url in recent {
                let item = NSMenuItem(title: url.lastPathComponent, action: #selector(openRecent(_:)), keyEquivalent: "")
                item.representedObject = url
                item.toolTip = url.path
                item.target = self
                recentMenu.addItem(item)
            }
        }
    }

    private func installMenus() {
        let main = NSMenu()
        func submenu(_ title: String) -> NSMenu {
            let item = NSMenuItem(title: title, action: nil, keyEquivalent: "")
            let menu = NSMenu(title: title)
            item.submenu = menu
            main.addItem(item)
            return menu
        }
        func item(_ title: String, _ action: Selector, _ shortcut: String = "", target: AnyObject? = nil) -> NSMenuItem {
            let item = NSMenuItem(title: title, action: action, keyEquivalent: shortcut)
            item.target = target
            return item
        }

        let app = submenu("Markfly")
        app.addItem(item("About Markfly", #selector(NSApplication.orderFrontStandardAboutPanel(_:))))
        app.addItem(.separator())
        let services = NSMenu(title: "Services")
        let servicesItem = NSMenuItem(title: "Services", action: nil, keyEquivalent: "")
        servicesItem.submenu = services
        app.addItem(servicesItem)
        NSApp.servicesMenu = services
        app.addItem(.separator())
        app.addItem(item("Hide Markfly", #selector(NSApplication.hide(_:)), "h"))
        let hideOthers = item("Hide Others", #selector(NSApplication.hideOtherApplications(_:)), "h")
        hideOthers.keyEquivalentModifierMask = [.command, .option]
        app.addItem(hideOthers)
        app.addItem(item("Show All", #selector(NSApplication.unhideAllApplications(_:))))
        app.addItem(.separator())
        app.addItem(item("Quit Markfly", #selector(NSApplication.terminate(_:)), "q"))

        let file = submenu("File")
        file.addItem(item("Open…", #selector(openFromMenu), "o", target: self))
        let recent = NSMenuItem(title: "Open Recent", action: nil, keyEquivalent: "")
        recent.submenu = recentMenu
        file.addItem(recent)
        refreshRecent()
        file.addItem(.separator())
        let pdf = item("Export PDF…", #selector(exportFromMenu(_:)), target: self)
        pdf.representedObject = "pdf"
        file.addItem(pdf)
        let word = item("Export Word…", #selector(exportFromMenu(_:)), target: self)
        word.representedObject = "word"
        file.addItem(word)
        file.addItem(.separator())
        file.addItem(item("Close Window", #selector(NSWindow.performClose(_:)), "w"))

        let edit = submenu("Edit")
        for (name, action, shortcut) in [
            ("Undo", "undo:", "z"), ("Redo", "redo:", "Z"), ("Cut", "cut:", "x"),
            ("Copy", "copy:", "c"), ("Paste", "paste:", "v"), ("Select All", "selectAll:", "a"),
        ] {
            edit.addItem(item(name, NSSelectorFromString(action), shortcut))
        }
        edit.addItem(.separator())
        edit.addItem(item("Find…", #selector(findFromMenu), "f", target: self))

        let view = submenu("View")
        let fullscreen = item("Enter Full Screen", #selector(NSWindow.toggleFullScreen(_:)), "f")
        fullscreen.keyEquivalentModifierMask = [.command, .control]
        view.addItem(fullscreen)

        let window = submenu("Window")
        window.addItem(item("Minimize", #selector(NSWindow.performMiniaturize(_:)), "m"))
        window.addItem(item("Zoom", #selector(NSWindow.performZoom(_:))))
        NSApp.windowsMenu = window

        let help = submenu("Help")
        help.addItem(item("Check for Updates…", #selector(checkForUpdates), target: self))
        NSApp.helpMenu = help
        NSApp.mainMenu = main
    }
}
