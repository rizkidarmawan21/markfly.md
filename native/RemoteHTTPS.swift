import Darwin
import Foundation

struct MarkflyError: LocalizedError {
    let message: String
    init(_ message: String) { self.message = message }
    var errorDescription: String? { message }
}

enum RemoteHTTPS {
    private static let queue = DispatchQueue(label: "com.markfly.https", qos: .userInitiated, attributes: .concurrent)
    private static let initialized: Void = markfly_https_init()

    static func safeURL(_ value: String) -> URL? {
        guard let url = URL(string: value),
              url.scheme?.lowercased() == "https",
              url.user == nil, url.password == nil,
              url.port.map({ (1...65535).contains($0) }) ?? true,
              let host = hostname(url), !host.isEmpty,
              host != "localhost", !host.hasSuffix(".localhost")
        else { return nil }

        var ipv4 = in_addr()
        var ipv6 = in6_addr()
        if inet_pton(AF_INET, host, &ipv4) == 1 {
            guard isPublicIPv4(UInt32(bigEndian: ipv4.s_addr)) else { return nil }
        } else if inet_pton(AF_INET6, host, &ipv6) == 1 {
            guard isPublicIPv6(ipv6) else { return nil }
        } else {
            // inet_aton also recognizes legacy forms such as 127.1 and 0x7f000001.
            guard inet_aton(host, &ipv4) == 0, host.utf8.allSatisfy({
                (97...122).contains($0) || (48...57).contains($0) || $0 == 45 || $0 == 46
            }) else { return nil }
        }
        return url
    }

    static func markdown(_ value: String) async throws -> (content: String, url: String) {
        guard var url = safeURL(value) else { throw MarkflyError("Enter a valid public HTTPS URL.") }
        if hostname(url) == "github.com", let components = URLComponents(url: url, resolvingAgainstBaseURL: false) {
            var raw = components
            let parts = raw.percentEncodedPath.split(separator: "/")
            if parts.count >= 5, parts[2] == "blob" {
                raw.host = "raw.githubusercontent.com"
                raw.percentEncodedPath = "/" + (Array(parts.prefix(2)) + parts.dropFirst(3)).joined(separator: "/")
                if let rawURL = raw.url { url = rawURL }
            }
        }
        let result = try await request(url, limit: MarkdownFiles.maxBytes,
                                       accept: "text/markdown, text/plain, text/*;q=0.9, */*;q=0.1")
        return (String(decoding: result.data, as: UTF8.self), result.url.absoluteString)
    }

    static func request(_ url: URL, limit: Int, accept: String, allowedHost: String? = nil) async throws -> (data: Data, url: URL) {
        _ = initialized
        return try await withCheckedThrowingContinuation { continuation in
            queue.async {
                continuation.resume(with: Result {
                    try fetch(url, limit: limit, accept: accept, allowedHost: allowedHost)
                })
            }
        }
    }

    private static func fetch(_ initialURL: URL, limit: Int, accept: String, allowedHost: String?) throws -> (Data, URL) {
        var current = initialURL
        for redirects in 0...5 {
            guard let url = safeURL(current.absoluteString), let host = hostname(url),
                  allowedHost == nil || host == allowedHost
            else { throw MarkflyError("Only public HTTPS URLs are supported.") }
            let addresses = try publicAddresses(host)
            var lastError: String?
            var nextURL: URL?
            for address in addresses {
                let target = address.contains(":") ? "[\(address)]" : address
                let response = markfly_https_get(url.absoluteString, "::\(target):\(url.port ?? 443)",
                                                 "Accept: \(accept)", limit)
                defer { markfly_https_free(response) }

                if let error = response.error {
                    lastError = String(cString: error)
                    if response.status != 0 || response.count > 0 || lastError?.contains("size limit") == true {
                        throw MarkflyError(lastError ?? "HTTPS request failed.")
                    }
                    continue
                }
                if (300..<400).contains(response.status), let redirect = response.redirect,
                   let next = URL(string: String(cString: redirect), relativeTo: url)?.absoluteURL {
                    guard redirects < 5 else { throw MarkflyError("URL redirected too many times.") }
                    nextURL = next
                    break
                }
                guard (200..<300).contains(response.status) else {
                    throw MarkflyError("Request failed (HTTP \(response.status)).")
                }
                let data = response.bytes.map { Data(bytes: $0, count: response.count) } ?? Data()
                return (data, url)
            }
            guard let nextURL else { throw MarkflyError(lastError ?? "HTTPS request failed.") }
            current = nextURL
        }
        throw MarkflyError("URL redirected too many times.")
    }

    private static func hostname(_ url: URL) -> String? {
        guard let rawHost = url.host(percentEncoded: true)?.lowercased() else { return nil }
        let host = rawHost.trimmingCharacters(in: CharacterSet(charactersIn: "[]"))
        return host.hasSuffix(".") ? String(host.dropLast()) : host
    }

    private static func publicAddresses(_ host: String) throws -> [String] {
        var hints = addrinfo()
        hints.ai_family = AF_UNSPEC
        hints.ai_socktype = SOCK_STREAM
        var result: UnsafeMutablePointer<addrinfo>?
        guard getaddrinfo(host, nil, &hints, &result) == 0, let first = result else {
            throw MarkflyError("Could not resolve the HTTPS host.")
        }
        defer { freeaddrinfo(first) }

        var current: UnsafeMutablePointer<addrinfo>? = first
        var addresses: [String] = []
        while let info = current?.pointee {
            current = info.ai_next
            guard let address = info.ai_addr else { continue }
            let isPublic: Bool
            switch info.ai_family {
            case AF_INET:
                let ipv4 = UnsafeRawPointer(address).load(as: sockaddr_in.self).sin_addr
                isPublic = isPublicIPv4(UInt32(bigEndian: ipv4.s_addr))
            case AF_INET6:
                let ipv6 = UnsafeRawPointer(address).load(as: sockaddr_in6.self).sin6_addr
                isPublic = isPublicIPv6(ipv6)
            default:
                continue
            }
            guard isPublic else { throw MarkflyError("URL must resolve to a public internet address.") }
            var numeric = [CChar](repeating: 0, count: Int(NI_MAXHOST))
            guard getnameinfo(address, info.ai_addrlen, &numeric, socklen_t(numeric.count),
                              nil, 0, NI_NUMERICHOST) == 0
            else { throw MarkflyError("Could not read the resolved HTTPS address.") }
            let value = String(cString: numeric)
            if !addresses.contains(value) { addresses.append(value) }
        }
        guard !addresses.isEmpty else { throw MarkflyError("Could not resolve the HTTPS host.") }
        return addresses
    }

    private static func isPublicIPv4(_ address: UInt32) -> Bool {
        let blocked: [(UInt32, UInt32)] = [
            (0x00000000, 8), (0x0a000000, 8), (0x64400000, 10), (0x7f000000, 8),
            (0xa9fe0000, 16), (0xac100000, 12), (0xc0000000, 24), (0xc0000200, 24),
            (0xc0a80000, 16), (0xc6120000, 15), (0xc6336400, 24), (0xcb007100, 24),
            (0xe0000000, 3),
        ]
        return !blocked.contains { base, prefix in
            let shift = 32 - prefix
            return address >> shift == base >> shift
        }
    }

    private static func isPublicIPv6(_ address: in6_addr) -> Bool {
        withUnsafeBytes(of: address) { bytes in
            // Global unicast, excluding documentation, Teredo and 6to4.
            bytes[0] & 0xe0 == 0x20 &&
            !(bytes[0] == 0x20 && bytes[1] == 0x02) &&
            !(bytes[0] == 0x20 && bytes[1] == 0x01 &&
              ((bytes[2] == 0x0d && bytes[3] == 0xb8) || (bytes[2] == 0 && bytes[3] == 0))) &&
            !(bytes[0] == 0x3f && bytes[1] == 0xff && bytes[2] & 0xf0 == 0)
        }
    }
}
