import Darwin
import Foundation

@MainActor
final class FileWatcher {
    private struct Revision: Equatable {
        let inode: ino_t
        let seconds: Int
        let nanoseconds: Int
        let size: off_t
    }

    private var url: URL?
    private var directory: DispatchSourceFileSystemObject?
    private var file: DispatchSourceFileSystemObject?
    private var revision: Revision?
    private var pendingChange: DispatchWorkItem?
    private let onChange: () -> Void

    init(onChange: @escaping () -> Void) {
        self.onChange = onChange
    }

    func watch(_ url: URL) {
        guard self.url != url || directory == nil else { return }
        stop()
        self.url = url
        revision = currentRevision()
        directory = watchEvents(url.deletingLastPathComponent(), events: [.write, .rename, .delete]) { [weak self] in
            self?.queueCheck()
        }
        watchFile()
    }

    func stop() {
        pendingChange?.cancel()
        pendingChange = nil
        directory?.cancel()
        directory = nil
        file?.cancel()
        file = nil
        revision = nil
        url = nil
    }

    private func watchFile() {
        file?.cancel()
        file = nil
        guard let url else { return }
        file = watchEvents(url, events: [.write, .extend, .attrib, .rename, .delete]) { [weak self] in
            self?.queueCheck()
        }
    }

    private func watchEvents(_ url: URL, events: DispatchSource.FileSystemEvent,
                             handleEvent: @escaping () -> Void) -> DispatchSourceFileSystemObject? {
        let fd = open(url.path, O_EVTONLY | O_NOFOLLOW | O_CLOEXEC)
        guard fd >= 0 else { return nil }
        let source = DispatchSource.makeFileSystemObjectSource(fileDescriptor: fd, eventMask: events, queue: .main)
        source.setEventHandler(handler: handleEvent)
        source.setCancelHandler { close(fd) }
        source.resume()
        return source
    }

    private func queueCheck() {
        pendingChange?.cancel()
        let item = DispatchWorkItem { [weak self] in
            guard let self else { return }
            let next = currentRevision()
            let replaceWatch = next?.inode != revision?.inode
            guard next != revision else { return }
            revision = next
            if replaceWatch { watchFile() }
            if next != nil { onChange() }
        }
        pendingChange = item
        DispatchQueue.main.asyncAfter(deadline: .now() + .milliseconds(120), execute: item)
    }

    private func currentRevision() -> Revision? {
        guard let path = url?.path else { return nil }
        var info = stat()
        guard lstat(path, &info) == 0, info.st_mode & S_IFMT == S_IFREG else { return nil }
        return Revision(inode: info.st_ino, seconds: info.st_mtimespec.tv_sec,
                        nanoseconds: info.st_mtimespec.tv_nsec, size: info.st_size)
    }
}
