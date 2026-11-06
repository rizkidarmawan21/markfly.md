#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")/.."
case "${1:-}" in
    "") build_dmg=false ;;
    --dmg) build_dmg=true ;;
    *) echo "Usage: scripts/build-native.sh [--dmg]" >&2; exit 2 ;;
esac

arch="${MARKFLY_ARCH:-$(uname -m)}"
case "$arch" in
    arm64|x86_64) ;;
    *) echo "Unsupported Mac architecture: $arch" >&2; exit 2 ;;
esac

identity="${MARKFLY_SIGN_IDENTITY:--}"
notary_profile="${MARKFLY_NOTARY_PROFILE:-}"
if [[ "$build_dmg" == true && "$identity" != "-" && -z "$notary_profile" ]] ||
   [[ -n "$notary_profile" && "$identity" == "-" ]]; then
    echo "Set both MARKFLY_SIGN_IDENTITY and MARKFLY_NOTARY_PROFILE for a notarized DMG." >&2
    exit 2
fi

npm run build
version=$(node -p "require('./package.json').version")
mkdir -p release/native
output="$(cd release/native && pwd)"
stage=$(mktemp -d "$output/.build.XXXXXX")
trap 'rm -rf "$stage"' EXIT

app="$stage/Markfly.app"
mkdir -p "$app/Contents/MacOS" "$app/Contents/Resources"
cp native/Info.plist "$app/Contents/Info.plist"
plutil -replace CFBundleShortVersionString -string "$version" "$app/Contents/Info.plist"
plutil -replace CFBundleVersion -string "$version" "$app/Contents/Info.plist"
ditto dist "$app/Contents/Resources/dist"
cp native/bridge.js "$app/Contents/Resources/bridge.js"

iconset="$stage/Markfly.iconset"
mkdir "$iconset"
for size in 16 32 128 256 512; do
    sips -z "$size" "$size" build/icon.png --out "$iconset/icon_${size}x${size}.png" >/dev/null
    double=$((size * 2))
    sips -z "$double" "$double" build/icon.png --out "$iconset/icon_${size}x${size}@2x.png" >/dev/null
done
iconutil --convert icns --output "$app/Contents/Resources/Markfly.icns" "$iconset"

target="$arch-apple-macos13.0"
xcrun clang -target "$target" -c native/PinnedHTTPS.c -o "$stage/PinnedHTTPS.o"
xcrun swiftc -target "$target" -O -import-objc-header native/PinnedHTTPS.h \
    native/*.swift "$stage/PinnedHTTPS.o" -lcurl -o "$app/Contents/MacOS/Markfly"

if [[ "$identity" == "-" ]]; then
    codesign --force --sign - "$app"
else
    codesign --force --sign "$identity" --options runtime --timestamp "$app"
fi
codesign --verify --strict "$app"

if [[ "$build_dmg" == true ]]; then
    image="$stage/Markfly-$version-native-$arch.dmg"
    mkdir "$stage/image"
    ditto "$app" "$stage/image/Markfly.app"
    ln -s /Applications "$stage/image/Applications"
    hdiutil create -volname Markfly -srcfolder "$stage/image" -ov -format UDZO "$image"
    if [[ "$identity" != "-" ]]; then
        codesign --sign "$identity" --timestamp "$image"
        xcrun notarytool submit "$image" --keychain-profile "$notary_profile" --wait
        xcrun stapler staple "$image"
        xcrun stapler validate "$image"
        spctl --assess --type open --context context:primary-signature "$image"
    fi
    mv -f "$image" "$output/"
    printf '%s\n' "$output/$(basename "$image")"
fi

app_output="$output/Markfly.app"
if [[ -e "$app_output" ]]; then mv "$app_output" "$stage/Previous.app"; fi
if ! mv "$app" "$app_output"; then
    if [[ -e "$stage/Previous.app" ]]; then mv "$stage/Previous.app" "$app_output"; fi
    exit 1
fi
printf '%s\n' "$app_output"
