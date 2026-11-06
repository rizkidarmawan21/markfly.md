import AppKit

@MainActor
final class UpdateCheck {
    private static let repository = "https://github.com/rizkidarmawan21/markfly.md/releases"
    private var release = URL(string: "\(repository)/latest")!
    private var revision = 0
    private var status = "idle"
    private var latestVersion: String?
    private var error: String?
    private let version: String
    private let publish: ([String: Any]) -> Void

    init(version: String, publish: @escaping ([String: Any]) -> Void) {
        self.version = version
        self.publish = publish
    }

    var state: [String: Any] {
        ["revision": revision, "status": status, "currentVersion": version,
         "latestVersion": latestVersion.map { $0 as Any } ?? NSNull(),
         "releaseInfoAvailable": false,
         "bytesReceived": 0, "totalBytes": NSNull(), "error": error.map { $0 as Any } ?? NSNull()]
    }

    func check() async -> [String: Any] {
        guard status != "checking" else { return state }
        error = nil
        setStatus("checking")
        do {
            let url = URL(string: "https://api.github.com/repos/rizkidarmawan21/markfly.md/releases/latest")!
            let response = try await RemoteHTTPS.request(url, limit: 1024 * 1024,
                                                         accept: "application/vnd.github+json", allowedHost: "api.github.com")
            let metadata = try JSONSerialization.jsonObject(with: response.data) as? [String: Any]
            guard let tag = metadata?["tag_name"] as? String,
                  let latest = Self.parts(tag), let current = Self.parts(version)
            else { throw MarkflyError("GitHub returned invalid release data.") }
            latestVersion = latest.map(String.init).joined(separator: ".")
            release = URL(string: "\(Self.repository)/tag/\(tag)")!
            setStatus(current.lexicographicallyPrecedes(latest) ? "available" : "current")
        } catch {
            self.error = error.localizedDescription
            setStatus("error")
        }
        return state
    }

    func openRelease() {
        NSWorkspace.shared.open(release)
    }

    private func setStatus(_ value: String) {
        status = value
        revision += 1
        publish(state)
    }

    private static func parts(_ version: String) -> [Int]? {
        let normalized = version.hasPrefix("v") ? String(version.dropFirst()) : version
        let values = normalized.split(separator: ".", omittingEmptySubsequences: false)
        let numbers = values.compactMap { Int($0) }
        guard values.count == 3, numbers.count == 3,
              numbers.allSatisfy({ $0 >= 0 }),
              numbers.map(String.init).joined(separator: ".") == normalized
        else { return nil }
        return numbers
    }
}
