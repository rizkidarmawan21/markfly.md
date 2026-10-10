# Markfly Manual Update Design

## Goal

Let Markfly users see whether a newer stable GitHub Release exists and download its macOS installer from inside the app. The app must not attempt a silent or privileged install because current releases are not configured with Apple Developer ID signing.

## User experience

- Check the latest stable GitHub Release when Markfly starts, with a short timeout and a bounded recheck interval. A native **Help → Check for Updates…** action runs the check on demand.
- Keep update status at the bottom of the left sidebar, matching the supplied cmux reference.
- After a successful check with no newer release, show **No Updates Available**.
- When a newer release exists, show its version and a distinct **Release Info** link that opens the canonical GitHub Release page.
- Provide a separate **Download Update** action. During download, show byte-based progress.
- After download and integrity verification, show **Installer Ready** and an **Open Installer** action. Open the downloaded `.pkg` in macOS Installer. Explain that the user must complete installation and reopen Markfly.
- Never report installation success or automatically restart Markfly: the app cannot observe or control a privileged manual `.pkg` installation reliably.
- Show retryable errors for network failure, GitHub rate limiting, missing assets, size mismatch, or digest mismatch. A failed or partial download must never be opened.

## Release lookup and asset selection

- The Electron main process queries `GET https://api.github.com/repos/rizkidarmawan21/markfly.md/releases/latest` over HTTPS. It ignores drafts and prereleases by using the stable latest endpoint.
- Compare the release tag version with `app.getVersion()` using semantic version ordering. Do not treat a tag as a newer version if it is malformed or older/equal.
- Use the release's `html_url` for **Release Info**, after validating that it is an HTTPS URL on `github.com` for this repository.
- Select exactly one asset matching the current supported architecture and release version, currently `Markfly-<version>-arm64.pkg`. If no matching `.pkg` exists, show an actionable error and retain the Release Info link.
- Download only the selected GitHub Release asset. Follow redirects only to GitHub's release asset host. Enforce a finite timeout and declared/actual size bounds.
- If the GitHub API supplies an asset SHA-256 digest, verify it before marking the installer ready. Keep downloads in a dedicated Markfly subdirectory under the OS temporary directory and use a version-specific filename.

## Architecture

- Electron main process owns GitHub requests, version comparison, asset validation, download lifecycle, digest verification, and opening the installer with Electron's shell API.
- Preload exposes a narrow typed API to request a check, start a download, open a verified installer, and subscribe/unsubscribe to update status/progress events. All IPC handlers use the existing trusted-sender guard.
- Vue sidebar renders the current update state and progress. It emits explicit actions for check, download, release info, and open installer. It does not fetch GitHub or receive arbitrary download URLs from renderer state.
- Native Help menu exposes **Check for Updates…** and forwards results through the same main-process updater state.
- Update operation state is ephemeral and is not added to user preferences. Persist only the last automatic-check timestamp under app user data to enforce the recheck interval. Remove incomplete downloads on failure or app shutdown.

## Security and reliability

- Treat GitHub API JSON and release notes as untrusted input. Render labels as text; allow only the exact repository's HTTPS release URL to open externally.
- Do not accept a renderer-provided download URL or filesystem destination. Main process derives both from validated release metadata.
- Verify asset filename, architecture, expected version, download size, and SHA-256 when available before opening the installer.
- Never invoke shell scripts, `installer`, `sudo`, or direct writes into `/Applications`.
- Rate-limit automatic checks locally; manual checks remain available. Coalesce concurrent checks/downloads.

## Scope and acceptance criteria

- Sidebar shows **No Updates Available** when installed version equals latest stable version.
- Sidebar shows the newer version, a separate GitHub release link, and **Download Update** when a matching release is available.
- Manual **Check for Updates…** and startup check use the same state flow.
- Download progress is visible and reaches **Installer Ready** only after size and digest validation.
- **Open Installer** opens only the verified `.pkg`; the UI clearly states manual installation and reopening are required.
- Invalid versions, wrong repository links, unsafe redirects, missing assets, oversized/corrupt downloads, offline checks, and repeated clicks fail safely and can be retried.
- No in-app privileged install, automatic app replacement, installation-success claim, or automatic restart is included.

## Delivery dependency

The current release workflow publishes architecture-specific `.pkg` assets. This design uses those assets and does not require Apple Developer Program membership. A later true in-app updater would require signed macOS releases and a separate migration plan for existing installs.
