import AppKit
import CoreFoundation
import Darwin
import Foundation

@MainActor
final class MarkdownFiles {
    nonisolated static let maxBytes = 5 * 1024 * 1024
    private static let extensions = ["md", "markdown", "mdown", "markdn"]

    private enum OpenMode {
        case userSelected, legacyRestore, nativeRestore
    }

    private struct Grant {
        let url: URL
        let directoryDevice: dev_t
        let directoryInode: ino_t
    }

    private var grants: [String: Grant] = [:]
    private(set) var recent: [String] = []
    private let preferences: URL
    private let previousPreferences: URL?
    let recordsSystemRecents: Bool

    init() {
        let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        if let override = ProcessInfo.processInfo.environment["MARKFLY_PREFS_DIR"], override.hasPrefix("/") {
            preferences = URL(fileURLWithPath: override, isDirectory: true).appendingPathComponent("prefs.json")
            previousPreferences = nil
            recordsSystemRecents = false
        } else {
            preferences = support.appendingPathComponent("com.markfly.app/prefs.json")
            previousPreferences = support.appendingPathComponent("markfly/prefs.json")
            recordsSystemRecents = true
        }

        let source = preferenceSource
        let mode: OpenMode = source == preferences ? .nativeRestore : .legacyRestore
        let saved = readPreferences(from: source)
        for tab in saved["tabs"] as? [Any] ?? [] {
            guard let path = Self.tabPath(tab), path.hasPrefix("/") else { continue }
            _ = try? authorize(URL(fileURLWithPath: path), mode: mode)
        }
    }

    func authorize(_ input: URL) throws -> String {
        try authorize(input, mode: .userSelected)
    }

    private func authorize(_ input: URL, mode: OpenMode) throws -> String {
        guard input.isFileURL, !input.path.utf8.contains(0), Self.isMarkdown(input) else {
            throw MarkflyError("Select a Markdown file.")
        }
        let original = input.path
        let url: URL
        if mode == .legacyRestore {
            let parent = try canonicalPath(input.deletingLastPathComponent().path)
            url = URL(fileURLWithPath: parent, isDirectory: true).appendingPathComponent(input.lastPathComponent)
        } else {
            let resolved = try canonicalPath(original)
            if mode == .nativeRestore, original != resolved {
                throw MarkflyError("The file's location changed. Open the file again.")
            }
            url = URL(fileURLWithPath: resolved)
        }
        guard Self.isMarkdown(url) else { throw MarkflyError("Select a Markdown file.") }
        let directory = url.deletingLastPathComponent()
        let fd = try openDirectory(directory)
        defer { close(fd) }
        var parent = stat()
        guard fstat(fd, &parent) == 0 else { throw MarkflyError("Unable to inspect the file's directory.") }
        let child = try openFile(url.lastPathComponent, in: fd)
        close(child)
        let grant = Grant(url: url, directoryDevice: parent.st_dev, directoryInode: parent.st_ino)
        grants[original] = grant
        grants[url.path] = grant
        return url.path
    }

    static func isMarkdown(_ url: URL) -> Bool {
        extensions.contains(url.pathExtension.lowercased())
    }

    func read(_ path: String) throws -> String {
        try withDirectory(path) { grant, directory in
            let file = try openFile(grant.url.lastPathComponent, in: directory)
            defer { close(file) }
            return String(decoding: try readDescriptor(file).data, as: UTF8.self)
        }
    }

    func save(_ path: String, expected: String, next: String) throws -> Bool {
        guard expected.utf8.count <= Self.maxBytes, next.utf8.count <= Self.maxBytes else {
            throw MarkflyError("Markdown file is larger than 5 MB.")
        }
        let expectedData = Data(expected.utf8)
        let nextData = Data(next.utf8)
        return try withDirectory(path) { grant, directory in
            let name = grant.url.lastPathComponent
            let original = try openFile(name, in: directory, writable: true)
            defer { close(original) }
            let current = try readDescriptor(original)
            guard current.data == expectedData else { return false }
            if current.data == nextData { return true }

            let temporaryName = ".markfly-\(UUID().uuidString).tmp"
            let staged = markfly_openat(directory, temporaryName, O_RDWR | O_CREAT | O_EXCL | O_NOFOLLOW | O_CLOEXEC, 0o600)
            guard staged >= 0 else { throw MarkflyError("Unable to stage the Markdown file for saving.") }
            let handle = FileHandle(fileDescriptor: staged, closeOnDealloc: true)
            defer { unlinkat(directory, temporaryName, 0) }

            try handle.write(contentsOf: nextData)
            guard fcopyfile(original, staged, nil, copyfile_flags_t(COPYFILE_ACL | COPYFILE_XATTR)) == 0,
                  fchown(staged, current.info.st_uid, current.info.st_gid) == 0,
                  fchmod(staged, current.info.st_mode & 0o777) == 0
            else { throw MarkflyError("Unable to preserve the Markdown file's permissions or attributes.") }
            try handle.synchronize()
            try handle.close()

            let checkDescriptor = try openFile(name, in: directory)
            defer { close(checkDescriptor) }
            let check = try readDescriptor(checkDescriptor)
            guard check.info.st_ino == current.info.st_ino, check.info.st_dev == current.info.st_dev,
                  check.data == expectedData else { return false }
            guard renameat(directory, temporaryName, directory, name) == 0 else {
                throw MarkflyError("Unable to replace the Markdown file.")
            }
            return true
        }
    }

    func watchURL(_ path: String) throws -> URL {
        try withDirectory(path) { grant, _ in grant.url }
    }

    func recordRecent(_ path: String) throws {
        guard let grant = grants[path] else { throw MarkflyError("File access was not authorized.") }
        recent.removeAll { $0 == path }
        recent.insert(path, at: 0)
        if recent.count > 10 { recent.removeLast() }
        if recordsSystemRecents { NSDocumentController.shared.noteNewRecentDocumentURL(grant.url) }
    }

    private func withDirectory<Result>(_ path: String, _ action: (Grant, Int32) throws -> Result) throws -> Result {
        guard let grant = grants[path] else { throw MarkflyError("File access was not authorized.") }
        guard (try? canonicalPath(path)) == grant.url.path else {
            throw MarkflyError("The file's location changed. Open the file again.")
        }
        let fd = try openDirectory(grant.url.deletingLastPathComponent())
        defer { close(fd) }
        var info = stat()
        guard fstat(fd, &info) == 0, info.st_dev == grant.directoryDevice, info.st_ino == grant.directoryInode else {
            throw MarkflyError("The file's directory changed. Open the file again.")
        }
        return try action(grant, fd)
    }

    private func canonicalPath(_ path: String) throws -> String {
        guard let resolved = realpath(path, nil) else { throw MarkflyError("Unable to find the selected Markdown file.") }
        defer { free(resolved) }
        return String(cString: resolved)
    }

    private func openDirectory(_ directory: URL) throws -> Int32 {
        let flags = O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC
        var descriptor = open("/", flags)
        guard descriptor >= 0 else { throw MarkflyError("Unable to open the file's directory.") }
        for component in directory.path.split(separator: "/") {
            let next = markfly_openat(descriptor, String(component), flags, 0)
            close(descriptor)
            guard next >= 0 else { throw MarkflyError("Unable to open the file's directory.") }
            descriptor = next
        }
        return descriptor
    }

    private func openFile(_ name: String, in directory: Int32, writable: Bool = false) throws -> Int32 {
        let access = writable ? O_RDWR : O_RDONLY
        let fd = markfly_openat(directory, name, access | O_NOFOLLOW | O_NONBLOCK | O_CLOEXEC, 0)
        guard fd >= 0 else { throw MarkflyError("Unable to open the selected Markdown file.") }
        var info = stat()
        guard fstat(fd, &info) == 0, info.st_mode & S_IFMT == S_IFREG else {
            close(fd)
            throw MarkflyError("Select a regular Markdown file.")
        }
        return fd
    }

    private func readDescriptor(_ fd: Int32) throws -> (data: Data, info: stat) {
        let handle = FileHandle(fileDescriptor: fd, closeOnDealloc: false)
        var info = stat()
        guard fstat(fd, &info) == 0 else { throw MarkflyError("Unable to inspect the selected Markdown file.") }
        guard info.st_size <= Self.maxBytes else { throw MarkflyError("Markdown file is larger than 5 MB.") }
        let data = try handle.read(upToCount: Self.maxBytes + 1) ?? Data()
        guard data.count <= Self.maxBytes else { throw MarkflyError("Markdown file is larger than 5 MB.") }
        return (data, info)
    }

    func loadPreferences() -> [String: Any] {
        sanitize(readPreferences(from: preferenceSource))
    }

    func savePreferences(_ value: [String: Any]) throws {
        let data = try JSONSerialization.data(withJSONObject: sanitize(value), options: [.sortedKeys])
        try FileManager.default.createDirectory(at: preferences.deletingLastPathComponent(),
                                                withIntermediateDirectories: true, attributes: [.posixPermissions: 0o700])
        try data.write(to: preferences, options: .atomic)
    }

    private var preferenceSource: URL? {
        FileManager.default.fileExists(atPath: preferences.path) ? preferences : previousPreferences
    }

    private func readPreferences(from source: URL?) -> [String: Any] {
        guard let source else { return [:] }
        let fd = open(source.path, O_RDONLY | O_NOFOLLOW | O_NONBLOCK | O_CLOEXEC)
        guard fd >= 0 else { return [:] }
        let handle = FileHandle(fileDescriptor: fd, closeOnDealloc: true)
        defer { try? handle.close() }
        var info = stat()
        guard fstat(fd, &info) == 0, info.st_mode & S_IFMT == S_IFREG, info.st_uid == getuid(),
              info.st_mode & 0o022 == 0,
              let data = try? handle.read(upToCount: 1024 * 1024 + 1), data.count <= 1024 * 1024,
              let value = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else { return [:] }
        return value
    }

    private static func tabPath(_ tab: Any) -> String? {
        (tab as? String) ?? (tab as? [String: Any])?["path"] as? String
    }

    private func sanitize(_ value: [String: Any]) -> [String: Any] {
        var result: [String: Any] = [:]
        if let dark = Self.boolean(value["dark"]) { result["dark"] = dark }
        if let sidebar = Self.boolean(value["sidebarVisible"]) { result["sidebarVisible"] = sidebar }
        if let width = Self.number(value["sidebarWidth"]), (180...400).contains(width) { result["sidebarWidth"] = width }
        var sourceByPath: [String: String] = [:]
        let tabs: [[String: Any]] = (value["tabs"] as? [Any] ?? []).compactMap { tab in
            guard let source = Self.tabPath(tab),
                  grants[source] != nil || RemoteHTTPS.safeURL(source) != nil else { return nil }
            let path = grants[source]?.url.path ?? source
            guard sourceByPath[path] == nil else { return nil }
            sourceByPath[path] = source
            return ["path": path, "active": Self.boolean((tab as? [String: Any])?["active"]) != false]
        }
        result["tabs"] = tabs
        if let source = value["activePath"] as? String {
            let path = grants[source]?.url.path ?? source
            if sourceByPath[path] != nil { result["activePath"] = path }
        }
        let savedViews = value["views"] as? [String: [String: Any]] ?? [:]
        result["views"] = Dictionary(uniqueKeysWithValues: sourceByPath.map { path, source in
            let view = savedViews[path] ?? savedViews[source]
            let zoom = Self.number(view?["zoom"]) ?? Self.number(value["zoom"]) ?? 1
            return (path, ["zoom": (0.5...3).contains(zoom) ? zoom : 1,
                           "showRaw": Self.boolean(view?["showRaw"]) ?? Self.boolean(value["showRaw"]) ?? false] as [String: Any])
        })
        return result
    }

    private static func boolean(_ value: Any?) -> Bool? {
        guard let number = value as? NSNumber, CFGetTypeID(number) == CFBooleanGetTypeID() else { return nil }
        return number.boolValue
    }

    private static func number(_ value: Any?) -> Double? {
        guard let number = value as? NSNumber, CFGetTypeID(number) != CFBooleanGetTypeID() else { return nil }
        return number.doubleValue
    }
}
