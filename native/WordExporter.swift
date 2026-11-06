import AppKit
import CryptoKit
import UniformTypeIdentifiers

enum WordExporter {
    private static let version = "3.13"
    private static let maxDiagrams = 24
    private static let maxImagePayload = 16 * 1024 * 1024
    private static let pandocLimits = ["+RTS", "-M256m", "-RTS", "--sandbox"]
    #if arch(arm64)
    private static let arch = "arm64"
    private static let archiveBytes = 43_148_194
    private static let archiveDigest = "f436d18bebbfb3ddd326597686dacab9fac5dc23bd060495020f35a28a43a7c3"
    private static let executableDigest = "8f17378a70e46eed7b63b5433fff6f5a0802f92659aa5782418548e0ca4a8e44"
    #elseif arch(x86_64)
    private static let arch = "x86_64"
    private static let archiveBytes = 26_891_866
    private static let archiveDigest = "1823278715aa405aaf21b59cde5dc789346aa8d4fc307467f9a9ee84162bedc5"
    private static let executableDigest = "dfc924e5328c23321a31894e3210d1a9e8f180265b1facee75bb0ad4287c89c7"
    #endif
    private static let archiveName = "pandoc-\(version)-\(arch)"
    @MainActor private static var saving = false

    @MainActor
    static func save(name: String, markdown: String, images: [String: String]) async throws -> Bool {
        guard !saving else { throw Failure.alreadySaving }
        saving = true
        defer { saving = false }

        let panel = NSSavePanel()
        panel.allowedContentTypes = [UTType(filenameExtension: "docx")!]
        panel.nameFieldStringValue = URL(fileURLWithPath: name).deletingPathExtension().lastPathComponent + ".docx"
        guard await panel.begin() == .OK, let destination = panel.url else { return false }

        let support: URL
        if let override = ProcessInfo.processInfo.environment["MARKFLY_PREFS_DIR"], override.hasPrefix("/") {
            support = URL(fileURLWithPath: override, isDirectory: true)
        } else {
            support = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask,
                                                  appropriateFor: nil, create: true)
                .appendingPathComponent("com.markfly.app", isDirectory: true)
        }
        let helper = support.appending(path: "Word Export/\(archiveName)/pandoc")
        let helperVerified = await Task.detached { isVerifiedHelper(helper) }.value
        if !helperVerified {
            let alert = NSAlert()
            alert.messageText = "Download Word export helper?"
            let size = Int((Double(archiveBytes) / 1_000_000).rounded())
            alert.informativeText = "Markfly will download Pandoc (\(size) MB) from GitHub. It will be stored for future offline exports. Your document stays on this Mac."
            alert.addButton(withTitle: "Download")
            alert.addButton(withTitle: "Cancel")
            guard alert.runModal() == .alertFirstButtonReturn else { return false }
            try await installHelper(at: helper)
        }

        try await Task.detached {
            let docx = try makeDOCX(markdown: markdown, images: images, helper: helper)
            try docx.write(to: destination, options: .atomic)
        }.value
        return true
    }

    private static func isVerifiedHelper(_ url: URL) -> Bool {
        let values = try? url.resourceValues(forKeys: [.isRegularFileKey, .isSymbolicLinkKey])
        return values?.isRegularFile == true && values?.isSymbolicLink == false
            && FileManager.default.isExecutableFile(atPath: url.path)
            && (try? digest(url)) == executableDigest
    }

    static func installHelper(at helper: URL) async throws {
        let source = URL(string: "https://github.com/jgm/pandoc/releases/download/\(version)/\(archiveName)-macOS.zip")!
        let config = URLSessionConfiguration.ephemeral
        config.httpShouldSetCookies = false
        config.urlCredentialStorage = nil
        config.timeoutIntervalForResource = 120
        let session = URLSession(configuration: config, delegate: DownloadRedirects(), delegateQueue: nil)
        defer { session.finishTasksAndInvalidate() }

        let downloaded: (URL, URLResponse)
        do {
            downloaded = try await session.download(from: source)
        } catch {
            throw Failure.download
        }
        let (archive, response) = downloaded
        defer { try? FileManager.default.removeItem(at: archive) }
        guard (response as? HTTPURLResponse)?.statusCode == 200,
              try archive.resourceValues(forKeys: [.fileSizeKey]).fileSize == archiveBytes,
              try digest(archive) == archiveDigest else { throw Failure.download }

        let files = FileManager.default
        let folder = helper.deletingLastPathComponent()
        try files.createDirectory(at: folder, withIntermediateDirectories: true,
                                  attributes: [.posixPermissions: 0o700])
        let staged = folder.appendingPathComponent(".install-\(UUID().uuidString)")
        defer { try? files.removeItem(at: staged) }
        guard files.createFile(atPath: staged.path, contents: nil, attributes: [.posixPermissions: 0o600]) else {
            throw Failure.install
        }
        let output = try FileHandle(forWritingTo: staged)
        defer { try? output.close() }
        try run(URL(fileURLWithPath: "/usr/bin/unzip"),
                arguments: ["-p", archive.path, "\(archiveName)/bin/pandoc"],
                directory: folder, output: output, failure: .install)
        guard try digest(staged) == executableDigest else { throw Failure.install }
        try files.setAttributes([.posixPermissions: 0o700], ofItemAtPath: staged.path)
        if files.fileExists(atPath: helper.path) {
            _ = try files.replaceItemAt(helper, withItemAt: staged, options: .usingNewMetadataOnly)
        } else {
            try files.moveItem(at: staged, to: helper)
        }
    }

    static func makeDOCX(markdown: String, images: [String: String], helper: URL) throws -> Data {
        guard markdown.utf8.count <= 5 * 1024 * 1024,
              images.count <= maxDiagrams,
              images.values.reduce(0, { $0 + $1.utf8.count }) <= maxImagePayload else {
            throw Failure.documentTooLarge
        }
        let files = FileManager.default
        let folder = files.temporaryDirectory.appendingPathComponent("markfly-word-\(UUID().uuidString)")
        try files.createDirectory(at: folder, withIntermediateDirectories: false,
                                  attributes: [.posixPermissions: 0o700])
        defer { try? files.removeItem(at: folder) }

        let source = folder.appendingPathComponent("source.md")
        let ast = folder.appendingPathComponent("document.json")
        let docx = folder.appendingPathComponent("document.docx")
        try Data(markdown.utf8).write(to: source)
        // Both readers/writers run with Pandoc's resource sandbox and no external filters.
        try run(helper, arguments: pandocLimits + ["-f", "gfm+tex_math_dollars-raw_html", "-t", "json",
                                                 "-o", ast.path, source.path], directory: folder)

        guard let astBytes = try ast.resourceValues(forKeys: [.fileSizeKey]).fileSize,
              astBytes <= 32 * 1024 * 1024 else { throw Failure.documentTooLarge }
        let document = try JSONSerialization.jsonObject(with: Data(contentsOf: ast))
        let rewritten = rewriteDocument(document, images: images)
        try JSONSerialization.data(withJSONObject: rewritten).write(to: ast, options: .atomic)
        try run(helper, arguments: pandocLimits + ["-f", "json", "-t", "docx",
                                                 "-o", docx.path, ast.path], directory: folder)
        return try Data(contentsOf: docx)
    }

    private static func rewriteDocument(_ document: Any, images: [String: String]) -> Any {
        var remainingDiagrams = maxDiagrams
        var remainingImageBytes = maxImagePayload

        func rewrite(_ value: Any) -> Any {
            if let children = value as? [Any] { return children.map(rewrite) }
            guard let node = value as? [String: Any] else { return value }
            if let type = node["t"] as? String, let content = node["c"] as? [Any] {
                if remainingDiagrams > 0, type == "CodeBlock", content.count == 2,
                   let attributes = content[0] as? [Any], attributes.count == 3,
                   let classes = attributes[1] as? [String], classes.first?.lowercased() == "mermaid",
                   let source = content[1] as? String {
                    let normalized = source.trimmingCharacters(in: CharacterSet(charactersIn: "\n"))
                    let name = "mermaid-\(hex(SHA256.hash(data: Data(normalized.utf8)))).png"
                    if let png = images[name], png.utf8.count <= remainingImageBytes,
                       let bytes = Data(base64Encoded: png), bytes.starts(with: [137, 80, 78, 71, 13, 10, 26, 10]) {
                        remainingDiagrams -= 1
                        remainingImageBytes -= png.utf8.count
                        let alt = [["t": "Str", "c": "Mermaid diagram"]]
                        let image: [String: Any] = ["t": "Image", "c": [attributes, alt, ["data:image/png;base64,\(png)", ""]]]
                        return ["t": "Para", "c": [image]]
                    }
                }
                if (type == "Image" || type == "Link"), content.count == 3,
                   let target = content[2] as? [String], let href = target.first {
                    if type == "Image", href.utf8.count <= remainingImageBytes, isEmbeddedImage(href) {
                        remainingImageBytes -= href.utf8.count
                    } else if type != "Link" || !isExternalLink(href) {
                        return ["t": "Span", "c": [content[0], rewrite(content[1])]]
                    }
                }
            }
            return node.mapValues(rewrite)
        }
        return rewrite(document)
    }

    private static func isEmbeddedImage(_ href: String) -> Bool {
        href.range(of: #"\Adata:image/(png|gif|jpe?g|webp|avif);base64,[a-z0-9+/=]+\z"#,
                   options: [.regularExpression, .caseInsensitive]) != nil
    }

    private static func isExternalLink(_ href: String) -> Bool {
        if href.hasPrefix("#") { return true }
        guard let url = URLComponents(string: href) else { return false }
        return url.scheme?.lowercased() == "https" && url.host?.isEmpty == false
            && url.user == nil && url.password == nil
    }

    private static func run(_ executable: URL, arguments: [String], directory: URL,
                            output: FileHandle = .nullDevice, failure: Failure = .conversion) throws {
        let process = Process()
        process.executableURL = executable
        process.arguments = arguments
        process.currentDirectoryURL = directory
        process.environment = ["HOME": directory.path, "TMPDIR": directory.path, "LANG": "en_US.UTF-8"]
        process.standardInput = FileHandle.nullDevice
        process.standardOutput = output
        process.standardError = FileHandle.nullDevice
        do { try process.run() } catch { throw failure }
        let timeout = DispatchWorkItem { if process.isRunning { process.terminate() } }
        DispatchQueue.global().asyncAfter(deadline: .now() + 45, execute: timeout)
        defer { timeout.cancel() }
        process.waitUntilExit()
        guard process.terminationStatus == 0 else { throw failure }
    }

    private static func digest(_ url: URL) throws -> String {
        let file = try FileHandle(forReadingFrom: url)
        defer { try? file.close() }
        var hasher = SHA256()
        while let chunk = try file.read(upToCount: 1024 * 1024), !chunk.isEmpty {
            hasher.update(data: chunk)
        }
        return hex(hasher.finalize())
    }

    private static func hex(_ digest: SHA256.Digest) -> String {
        digest.map { String(format: "%02x", $0) }.joined()
    }

    private enum Failure: LocalizedError {
        case alreadySaving, documentTooLarge, download, install, conversion

        var errorDescription: String? {
            switch self {
            case .alreadySaving: "A Word export is already in progress."
            case .documentTooLarge: "This document is too large to export to Word."
            case .download: "Markfly couldn’t download and verify the Word export helper from GitHub."
            case .install: "Markfly couldn’t prepare the Word export helper."
            case .conversion: "Markfly couldn’t convert this document to Word."
            }
        }
    }

    private final class DownloadRedirects: NSObject, URLSessionTaskDelegate {
        func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse,
                        newRequest request: URLRequest, completionHandler: @escaping @Sendable (URLRequest?) -> Void) {
            let url = request.url
            let allowed = url?.scheme == "https" && url?.user == nil && url?.password == nil
                && (url?.host == "github.com" || url?.host == "release-assets.githubusercontent.com")
            completionHandler(allowed ? request : nil)
        }
    }
}
