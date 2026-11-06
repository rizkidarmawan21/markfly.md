#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."

scratch=$(mktemp -d "${TMPDIR:-/tmp}/markfly-tests.XXXXXX")
trap 'rm -rf "$scratch"' EXIT
target="$(uname -m)-apple-macos13.0"

xcrun clang -target "$target" -c native/PinnedHTTPS.c -o "$scratch/PinnedHTTPS.o"
xcrun swiftc -target "$target" -import-objc-header native/PinnedHTTPS.h \
    native/tests/ShellSmoke.swift native/MarkdownFiles.swift native/FileWatcher.swift \
    native/RemoteHTTPS.swift "$scratch/PinnedHTTPS.o" -lcurl -o "$scratch/shell"
"$scratch/shell"

xcrun swiftc -target "$target" native/tests/PDFSmoke.swift native/PDFExporter.swift -o "$scratch/pdf"
"$scratch/pdf" "$PWD/dist" "$scratch"

if [[ -n "${1:-}" ]]; then
    xcrun swiftc -target "$target" native/tests/WordSmoke.swift native/WordExporter.swift -o "$scratch/word"
    "$scratch/word" "$1" "$scratch"
fi
