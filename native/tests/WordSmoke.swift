import CryptoKit
import Foundation

@main
struct WordSmoke {
    static func main() throws {
        let args = Array(CommandLine.arguments.dropFirst())
        precondition(args.count == 2, "Usage: WordSmoke <pandoc> <output directory>")
        let helper = URL(fileURLWithPath: args[0])
        let output = URL(fileURLWithPath: args[1], isDirectory: true)
        let files = FileManager.default
        let secret = files.temporaryDirectory.appendingPathComponent("markfly-secret-\(UUID().uuidString).png")
        let exported = output.appendingPathComponent("word-smoke.docx")
        let png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2l8AAAAASUVORK5CYII="
        try Data(base64Encoded: png)!.write(to: secret)
        defer { try? files.removeItem(at: secret) }

        let diagram = "graph LR\n  A[Draft] --> B[Shared]"
        let digest = SHA256.hash(data: Data(diagram.utf8)).map { String(format: "%02x", $0) }.joined()
        let markdown = """
        # Word Smoke

        | Name  | Status |
        | ----- | ------ |
        | Alpha | Ready  |

        $$
        E=mc^2
        $$

        ```mermaid
        \(diagram)
        ```

        > - ```Mermaid
        >   graph LR
        >     A[Draft] --> B[Shared]
        >   ```

        ```mermaid
        unmatched diagram source
        ```

        ![Local image](<\(secret.path)>)
        ![Remote image](https://example.org/secret.png)
        [External link](https://example.org/docs)
        [Unsafe link](file:///private/etc/hosts)
        """
        let docx = try WordExporter.makeDOCX(markdown: markdown, images: ["mermaid-\(digest).png": png], helper: helper)
        try docx.write(to: exported)
        let document = try unzip(["-p", exported.path, "word/document.xml"])
        let relationships = try unzip(["-p", exported.path, "word/_rels/document.xml.rels"])
        let entries = try unzip(["-Z1", exported.path])
        for expected in ["Heading1", "<w:tbl>", "<m:oMath", ">unmatched</w:t>", "Local image", "Remote image"] {
            precondition(document.contains(expected), "Missing \(expected)")
        }
        precondition(document.components(separatedBy: "<w:drawing>").count == 3, "Expected two Mermaid drawings")
        precondition(entries.components(separatedBy: "word/media/").count == 2, "Expected a single shared image")
        precondition(relationships.contains("https://example.org/docs"), "Missing HTTPS link")
        precondition(!relationships.contains("secret.png") && !relationships.contains("file:///"), "Unsafe relationship")
        print("Word smoke passed: editable heading, table, equation, nested diagrams and safe relationships.")
    }

    private static func unzip(_ arguments: [String]) throws -> String {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/unzip")
        process.arguments = arguments
        let output = Pipe()
        process.standardOutput = output
        try process.run()
        let data = output.fileHandleForReading.readDataToEndOfFile()
        process.waitUntilExit()
        precondition(process.terminationStatus == 0, "Could not read DOCX")
        return String(decoding: data, as: UTF8.self)
    }
}
