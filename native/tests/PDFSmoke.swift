import AppKit
import PDFKit

@main
struct PDFSmoke {
    @MainActor
    static func main() async throws {
        NSApplication.shared.setActivationPolicy(.prohibited)
        let resources = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
        let folder = URL(fileURLWithPath: CommandLine.arguments[2], isDirectory: true)
        let rows = (1...100).map { "<tr><td>Row \($0)</td><td>Payload \($0)</td></tr>" }.joined()
        let paragraphs = (1...20).map { "<p>Paragraph \($0) contains searchable document text.</p>" }.joined()
        let diagram = #"<svg viewBox="0 0 300 100" xmlns="http://www.w3.org/2000/svg"><rect x="5" y="5" width="290" height="90" fill="lightblue"/><text x="22" y="48">Diagram Marker</text></svg>"#
        let html = "<h1>First Marker</h1>\(paragraphs)<table><thead><tr><th>Name</th><th>Value</th></tr></thead><tbody>\(rows)</tbody></table><div class=\"mermaid-block\">\(diagram)</div><p>Last Marker</p>"
        for (format, width, height) in [("A4", 595.28, 841.89), ("Letter", 612.0, 792.0)] {
            let bytes = try await PDFExporter.makePDF(html: html, pageSize: format, resources: resources)
            guard let doc = PDFDocument(data: bytes), doc.pageCount > 1 else {
                fatalError("\(format) did not paginate")
            }
            for index in 0..<doc.pageCount {
                guard let page = doc.page(at: index), let text = page.string, !text.isEmpty else {
                    fatalError("\(format) blank page \(index + 1)")
                }
                let bounds = page.bounds(for: .mediaBox)
                precondition(abs(bounds.width - width) < 1 && abs(bounds.height - height) < 1)
            }
            let text = doc.string ?? ""
            for marker in ["First Marker", "Row 1", "Row 55", "Row 100", "Diagram Marker", "Last Marker"] {
                precondition(text.contains(marker), "Missing text: \(marker)")
            }
            let pattern = try NSRegularExpression(pattern: #"Row (\d+)"#)
            let rowNumbers = pattern.matches(in: text, range: NSRange(text.startIndex..., in: text)).compactMap { match in
                Range(match.range(at: 1), in: text).flatMap { Int(text[$0]) }
            }
            precondition(rowNumbers == Array(1...100), "Rows missing, duplicated, or out of order")
            try bytes.write(to: folder.appendingPathComponent("\(format).pdf"))
            print("\(format) \(doc.pageCount) pages, all markers present")
        }
        let markers = (1...420).map { "m\($0)Z" }
        let tallRow = "<table><thead><tr><th>Label</th><th>Other</th></tr></thead><tbody><tr><td>\(markers.joined(separator: " "))</td><td>RightColumn</td></tr></tbody></table><p>EndDocument</p>"
        let large = try await PDFExporter.makePDF(html: tallRow, pageSize: "A4", resources: resources)
        let tallText = PDFDocument(data: large)?.string ?? ""
        precondition(markers.allSatisfy(tallText.contains), "Tall table row lost text")
        precondition(tallText.contains("RightColumn") && tallText.contains("EndDocument"))
        let code = "<pre><code><span class=\"hljs-string\">\(markers.joined(separator: " "))</span></code></pre><p>EndCode</p>"
        let codePDF = try await PDFExporter.makePDF(html: code, pageSize: "A4", resources: resources)
        let codeText = PDFDocument(data: codePDF)?.string ?? ""
        precondition(markers.allSatisfy(codeText.contains) && codeText.contains("EndCode"), "Code lost text")
        do {
            let wide = "<p style=\"white-space:nowrap\">\(markers.joined(separator: " "))</p>"
            _ = try await PDFExporter.makePDF(html: wide, pageSize: "A4", resources: resources)
            fatalError("Oversized unbreakable content was silently clipped")
        } catch {
            precondition(error.localizedDescription.contains("does not fit"))
        }
        print("Tall table row: all \(markers.count) markers present")
    }
}
