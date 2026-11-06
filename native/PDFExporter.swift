import AppKit
import CoreGraphics
import UniformTypeIdentifiers
import WebKit

@MainActor
enum PDFExporter {
    static func save(name: String, html: String, pageSize: String) async throws -> Bool {
        let panel = NSSavePanel()
        panel.allowedContentTypes = [.pdf]
        panel.nameFieldStringValue = URL(fileURLWithPath: name).deletingPathExtension().lastPathComponent + ".pdf"
        let format = NSPopUpButton(frame: NSRect(x: 90, y: 9, width: 112, height: 26))
        format.addItems(withTitles: ["A4", "Letter"])
        format.selectItem(withTitle: pageSize)
        let label = NSTextField(labelWithString: "Paper size")
        label.frame = NSRect(x: 16, y: 12, width: 72, height: 20)
        let accessory = NSView(frame: NSRect(x: 0, y: 0, width: 216, height: 43))
        accessory.addSubview(label)
        accessory.addSubview(format)
        panel.accessoryView = accessory
        guard await panel.begin() == .OK, let destination = panel.url else { return false }
        let resources = Bundle.main.resourceURL!.appendingPathComponent("dist", isDirectory: true)
        let data = try await makePDF(html: html, pageSize: format.titleOfSelectedItem ?? pageSize, resources: resources)
        try data.write(to: destination, options: .atomic)
        return true
    }

    static func makePDF(html: String, pageSize: String, resources: URL) async throws -> Data {
        let paper: CGSize
        switch pageSize {
        case "A4": paper = CGSize(width: 595.28, height: 841.89)
        case "Letter": paper = CGSize(width: 612, height: 792)
        default: throw Failure.pageSize
        }
        guard html.utf8.count <= 24 * 1024 * 1024 else { throw Failure.documentTooLarge }
        let margin = 36.0
        let width = floor(paper.width - margin * 2)
        let height = floor(paper.height - margin * 2)
        let gap = margin * 2
        let assets = resources.appendingPathComponent("assets", isDirectory: true)
        let source = PDFDocumentSource(html: html, assets: assets, width: width, height: height, gap: gap)
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .nonPersistent()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = false
        configuration.setURLSchemeHandler(source, forURLScheme: "markfly-pdf")
        let view = WKWebView(frame: CGRect(x: 0, y: 0, width: width, height: height), configuration: configuration)
        try await source.load(in: view)
        let metrics = try await view.callAsyncJavaScript("""
            await document.fonts.ready;
            await Promise.all(Array.from(document.images, image => image.decode().catch(() => {})));
            const main = document.querySelector('main');
            main.style.columnWidth = 'auto';
            main.style.columnCount = '1';
            main.style.height = 'auto';
            const range = document.createRange();
            range.selectNodeContents(main);
            const content = range.getBoundingClientRect();
            const isTooWide = main.scrollWidth > main.clientWidth + 1
                || content.left < -1 || content.right > main.clientWidth + 1;
            for (const name of ['column-width', 'column-count', 'height']) main.style.removeProperty(name);
            return { width: main.scrollWidth, tooWide: isTooWide, tooTall: main.scrollHeight > main.clientHeight + 1 };
            """, arguments: [:], in: nil, contentWorld: .defaultClient)
        guard let layout = metrics as? [String: Any],
              let measuredWidth = layout["width"] as? Double, measuredWidth.isFinite else { throw Failure.render }
        guard layout["tooWide"] as? Bool == false, layout["tooTall"] as? Bool == false else {
            throw Failure.contentDoesNotFit
        }
        let pages = Int(ceil((measuredWidth + gap) / (width + gap)))
        guard (1...200).contains(pages) else { throw Failure.documentTooLarge }

        let buffer = NSMutableData()
        guard let consumer = CGDataConsumer(data: buffer as CFMutableData) else { throw Failure.render }
        var mediaBox = CGRect(origin: .zero, size: paper)
        guard let output = CGContext(consumer: consumer, mediaBox: &mediaBox, nil) else { throw Failure.render }
        for index in 0..<pages {
            try Task.checkCancellation()
            if index > 0 {
                _ = try await view.callAsyncJavaScript(
                    "document.querySelector('main').style.transform = 'translateX(' + offset + 'px)';",
                    arguments: ["offset": -Double(index) * (width + gap)], in: nil, contentWorld: .defaultClient
                )
            }
            let capture = WKPDFConfiguration()
            capture.rect = CGRect(x: 0, y: 0, width: width, height: height)
            let data = try await view.pdf(configuration: capture)
            guard let provider = CGDataProvider(data: data as CFData),
                  let sourcePDF = CGPDFDocument(provider), let page = sourcePDF.page(at: 1) else {
                throw Failure.render
            }
            output.beginPDFPage(nil)
            output.saveGState()
            output.translateBy(x: margin, y: paper.height - margin - height)
            output.clip(to: CGRect(x: 0, y: 0, width: width, height: height))
            output.drawPDFPage(page)
            output.restoreGState()
            output.endPDFPage()
        }
        output.closePDF()
        return buffer as Data
    }

    private enum Failure: LocalizedError {
        case pageSize, documentTooLarge, contentDoesNotFit, render
        var errorDescription: String? {
            switch self {
            case .pageSize: return "Choose A4 or Letter for PDF export."
            case .documentTooLarge: return "This document exceeds the PDF export limit."
            case .contentDoesNotFit: return "Part of this document does not fit the selected paper size."
            case .render: return "Markfly could not render this document as a PDF."
            }
        }
    }
}

@MainActor
private final class PDFDocumentSource: NSObject, WKURLSchemeHandler, WKNavigationDelegate {
    private static let entry = URL(string: "markfly-pdf://bundle/document.html")!
    private let document: Data
    private let assets: URL
    private var navigation: CheckedContinuation<Void, Error>?

    init(html: String, assets: URL, width: Double, height: Double, gap: Double) {
        self.assets = assets
        let css = (try? FileManager.default.contentsOfDirectory(atPath: assets.path))?
            .first(where: { $0.range(of: #"^index-[\w-]+\.css$"#, options: .regularExpression) != nil })
        let stylesheet = css.map { "<link rel=\"stylesheet\" href=\"/assets/\($0)\">" } ?? ""
        document = Data("""
            <!doctype html><html lang="en"><head><meta charset="utf-8">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src data:; base-uri 'none'; form-action 'none'; frame-src 'none'">
            \(stylesheet)
            <style>
            html, body { margin: 0; padding: 0; background: white; color: #171717; color-scheme: light; }
            main.markdown-body {
                display: block; box-sizing: content-box; margin: 0; padding: 0;
                width: \(width)px; height: \(height)px; max-width: none;
                column-width: \(width)px; column-gap: \(gap)px; column-fill: auto;
                font: 13px/1.55 -apple-system, BlinkMacSystemFont, sans-serif;
                background: white; color: #171717; overflow-wrap: anywhere;
                --fgColor-default: #171717; --bgColor-default: white;
                --bgColor-muted: #f5f5f5; --borderColor-default: #d0d0d0;
                --borderColor-muted: #dedede;
            }
            main.markdown-body :is(h1,h2,h3,h4,h5,h6) { break-after: avoid; }
            main.markdown-body :is(p,li) { orphans: 2; widows: 2; }
            main.markdown-body table { display: table; width: 100%; table-layout: fixed; overflow: visible; white-space: normal; }
            main.markdown-body :is(tr,figure,.mermaid-block,.katex-display) { break-inside: avoid; }
            main.markdown-body :is(img,svg) { max-width: 100%; max-height: \(height - 12)px; object-fit: contain; }
            main.markdown-body :is(pre,pre code) { white-space: pre-wrap; overflow-wrap: anywhere; overflow: visible; }
            main.markdown-body .mermaid-block { display: block; border: 0; background: white; padding: 0; }
            main.markdown-body .mermaid-content { display: block; }
            main.markdown-body .mermaid-diagram { display: block; padding: 0; }
            main.markdown-body .katex-display { overflow: visible; }
            </style></head><body><main class="markdown-body">\(html)</main></body></html>
            """.utf8)
    }

    func load(in view: WKWebView) async throws {
        view.navigationDelegate = self
        try await withCheckedThrowingContinuation { continuation in
            navigation = continuation
            view.load(URLRequest(url: Self.entry))
        }
    }

    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction) async -> WKNavigationActionPolicy {
        action.request.url == Self.entry && action.targetFrame?.isMainFrame == true ? .allow : .cancel
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { finish(.success(())) }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { finish(.failure(error)) }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { finish(.failure(error)) }

    private func finish(_ result: Result<Void, Error>) {
        navigation?.resume(with: result)
        navigation = nil
    }

    func webView(_ webView: WKWebView, start task: any WKURLSchemeTask) {
        guard let url = task.request.url, url.host == "bundle" else {
            task.didFailWithError(URLError(.unsupportedURL))
            return
        }
        if url == Self.entry {
            respond(task, url: url, type: "text/html", data: document)
            return
        }
        let parts = url.pathComponents
        let name = url.lastPathComponent
        let types = ["css": "text/css", "woff2": "font/woff2", "woff": "font/woff", "ttf": "font/ttf"]
        guard parts.count == 3, parts[1] == "assets",
              name.range(of: #"^[\w.-]+$"#, options: .regularExpression) != nil,
              let type = types[url.pathExtension],
              let data = try? Data(contentsOf: assets.appendingPathComponent(name)) else {
            task.didFailWithError(URLError(.fileDoesNotExist))
            return
        }
        respond(task, url: url, type: type, data: data)
    }

    func webView(_ webView: WKWebView, stop task: any WKURLSchemeTask) {}

    private func respond(_ task: any WKURLSchemeTask, url: URL, type: String, data: Data) {
        task.didReceive(URLResponse(url: url, mimeType: type, expectedContentLength: data.count, textEncodingName: nil))
        task.didReceive(data)
        task.didFinish()
    }
}
