import UniformTypeIdentifiers
import WebKit

@MainActor
final class BundleScheme: NSObject, WKURLSchemeHandler {
    static let name = "markfly"
    static let entry = URL(string: "markfly://app/index.html")!
    private let root: URL

    init(resources: URL) {
        root = resources.appendingPathComponent("dist", isDirectory: true).resolvingSymlinksInPath()
    }

    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        guard let url = task.request.url, url.scheme == Self.name, url.host == "app",
              url.user == nil, url.password == nil, url.port == nil,
              let method = task.request.httpMethod, method == "GET" || method == "HEAD",
              let file = bundledFile(for: url)
        else {
            task.didFailWithError(URLError(.resourceUnavailable))
            return
        }
        do {
            let values = try file.resourceValues(forKeys: [.isRegularFileKey])
            guard values.isRegularFile == true else { throw URLError(.resourceUnavailable) }
            let data = try Data(contentsOf: file, options: .mappedIfSafe)
            let mime: String
            if file.pathExtension == "js" { mime = "text/javascript" }
            else if file.pathExtension == "css" { mime = "text/css" }
            else { mime = UTType(filenameExtension: file.pathExtension)?.preferredMIMEType ?? "application/octet-stream" }

            let headers = ["Content-Type": mime, "Content-Length": String(data.count),
                           "X-Content-Type-Options": "nosniff",
                           "Access-Control-Allow-Origin": "*"]
            guard let response = HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1", headerFields: headers)
            else { throw URLError(.badServerResponse) }
            task.didReceive(response)
            if method == "GET" { task.didReceive(data) }
            task.didFinish()
        } catch {
            task.didFailWithError(error)
        }
    }

    func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {}

    private func bundledFile(for url: URL) -> URL? {
        let path = url.path(percentEncoded: false)
        guard path == "/index.html" || path.hasPrefix("/assets/") else { return nil }
        let parts = path.split(separator: "/", omittingEmptySubsequences: true)
        guard parts.allSatisfy({ $0 != "." && $0 != ".." }) else { return nil }
        let file = root.appendingPathComponent(parts.joined(separator: "/")).resolvingSymlinksInPath()
        return file.path.hasPrefix(root.path + "/") ? file : nil
    }
}
