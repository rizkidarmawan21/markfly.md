import Darwin
import Foundation

@main
@MainActor
enum ShellSmoke {
    static func main() async throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent("markfly-shell-\(UUID())")
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: root) }
        setenv("MARKFLY_PREFS_DIR", root.path, 1)

        let selected = root.appendingPathComponent("selected.md")
        let blocked = root.appendingPathComponent("blocked.md")
        let body = "# Original\r\n"
        try Data(body.utf8).write(to: selected)
        try Data("# Unselected\n".utf8).write(to: blocked)
        let files = MarkdownFiles()
        try rejects("unselected read") { try files.read(blocked.path) }

        let path = try files.authorize(selected)
        try require(try files.read(path) == body, "authorized read preserves CRLF")
        try require(try !files.save(path, expected: "stale", next: "# Changed"), "stale edit is rejected")
        try require(try files.read(path) == body, "conflict leaves file unchanged")

        try require(chmod(selected.path, 0o640) == 0, "set source permissions")
        let tag = "tag"
        let tagName = "com.markfly.smoke"
        try require(tag.withCString { setxattr(selected.path, tagName, $0, tag.utf8.count, 0, 0) } == 0,
                    "set extended attribute")

        var watcherEvents = 0
        let watcher = FileWatcher { watcherEvents += 1 }
        watcher.watch(try files.watchURL(path))
        defer { watcher.stop() }
        let update = "# Updated\r\n"
        try require(try files.save(path, expected: body, next: update), "atomic save")
        try await wait("watcher sees atomic replacement") { watcherEvents > 0 }
        try require(try files.read(path) == update, "read replacement")
        var statInfo = stat()
        try require(stat(path, &statInfo) == 0 && statInfo.st_mode & 0o777 == 0o640, "mode preserved")
        var attribute = [UInt8](repeating: 0, count: tag.utf8.count)
        let attributeCount = getxattr(path, tagName, &attribute, attribute.count, 0, 0)
        try require(attributeCount == tag.utf8.count && String(decoding: attribute, as: UTF8.self) == tag,
                    "extended attribute preserved")

        let count = watcherEvents
        let handle = try FileHandle(forWritingTo: selected)
        try handle.seekToEnd()
        try handle.write(contentsOf: Data("Append\n".utf8))
        try handle.close()
        try await wait("watcher follows replacement inode") { watcherEvents > count }

        try files.savePreferences(["dark": true, "tabs": [path, blocked.path, "https://127.1/", "https://example.org/"],
                                   "activePath": blocked.path, "views": [path: ["zoom": 2, "showRaw": true]]])
        let reloaded = MarkdownFiles()
        let pref = reloaded.loadPreferences()
        try require((pref["tabs"] as? [[String: Any]])?.compactMap { $0["path"] as? String } == [path, "https://example.org/"],
                    "saved prefs exclude unauthorized paths")
        try require(pref["activePath"] == nil, "saved prefs exclude unauthorized active path")
        try require(try reloaded.read(path) == update + "Append\n", "authorized tab restores from prefs")
        try rejects("saved prefs cannot grant unselected path") { try reloaded.read(blocked.path) }

        let alias = root.appendingPathComponent("alias.md")
        try FileManager.default.createSymbolicLink(at: alias, withDestinationURL: selected)
        let aliasPath = try files.authorize(alias)
        try require(aliasPath == path, "an explicit symlink open persists the canonical file")
        try files.savePreferences(["tabs": [alias.path], "activePath": alias.path,
                                   "views": [alias.path: ["zoom": 2, "showRaw": true]]])
        let aliasRestored = MarkdownFiles()
        let aliasPreferences = aliasRestored.loadPreferences()
        try require(try aliasRestored.read(aliasPath) == update + "Append\n", "canonical tab restores")
        try require(aliasPreferences["activePath"] as? String == aliasPath, "active alias becomes canonical")
        let aliasViews = aliasPreferences["views"] as? [String: [String: Any]]
        try require(aliasViews?[aliasPath]?["zoom"] as? Double == 2, "legacy alias view is retained")

        try FileManager.default.removeItem(at: selected)
        try FileManager.default.createSymbolicLink(at: selected, withDestinationURL: blocked)
        try rejects("grant cannot be redirected by a symlink replacement") { try files.read(path) }
        let afterReplacement = MarkdownFiles()
        try rejects("saved grant cannot be redirected by a symlink replacement") { try afterReplacement.read(path) }

        let originalFolder = root.appendingPathComponent("original")
        let replacedFolder = root.appendingPathComponent("replacement")
        let movedFolder = root.appendingPathComponent("moved")
        try FileManager.default.createDirectory(at: originalFolder, withIntermediateDirectories: false)
        try FileManager.default.createDirectory(at: replacedFolder, withIntermediateDirectories: false)
        let originalFile = originalFolder.appendingPathComponent("same.md")
        try Data("Allowed".utf8).write(to: originalFile)
        try Data("Unselected".utf8).write(to: replacedFolder.appendingPathComponent("same.md"))
        let folderGrant = try files.authorize(originalFile)
        try files.savePreferences(["tabs": [folderGrant]])
        try FileManager.default.moveItem(at: originalFolder, to: movedFolder)
        try FileManager.default.createSymbolicLink(at: originalFolder, withDestinationURL: replacedFolder)
        try rejects("live grant cannot follow a replaced parent") { try files.read(folderGrant) }
        let afterFolderReplacement = MarkdownFiles()
        try rejects("restored grant cannot follow a replaced parent") { try afterFolderReplacement.read(folderGrant) }

        for url in ["https://localhost./", "https://127.1/", "https://[::1]/", "https://169.254.169.254/",
                    "https://user:secret@example.org/", "http://example.org/"] {
            try require(RemoteHTTPS.safeURL(url) == nil, "blocked URL \(url)")
        }
        try require(RemoteHTTPS.safeURL("https://example.org/file.md") != nil, "allow public HTTPS URL")
        print("Native shell smoke passed.")
    }

    private static func require(_ condition: @autoclosure () throws -> Bool, _ label: String) throws {
        guard try condition() else { throw MarkflyError(label) }
    }

    private static func rejects<T>(_ label: String, _ action: () throws -> T) throws {
        do { _ = try action() }
        catch { return }
        throw MarkflyError(label)
    }

    private static func wait(_ label: String, until: () -> Bool) async throws {
        for _ in 0..<50 {
            if until() { return }
            try await Task.sleep(for: .milliseconds(50))
        }
        throw MarkflyError(label)
    }
}
