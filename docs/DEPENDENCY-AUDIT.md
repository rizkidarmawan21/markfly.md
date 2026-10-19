# Dependency audit

Audit snapshot: 2026-10-20, `package-lock.json` for Markfly `0.4.2`.

## Verification

```bash
npm audit
npm audit --omit=dev
```

Results from the npm registry at audit time:

| Scope | Critical | High | Moderate | Low | Total |
| --- | ---: | ---: | ---: | ---: | ---: |
| Full dependency tree | 0 | 0 | 8 | 0 | 8 |
| Production dependencies | 0 | 0 | 0 | 0 | 0 |

Compatible dependency and lockfile updates are included in the security-hardening change. No forced downgrade was applied.

## Remaining findings

### `electron-builder` packaging chain — 8 moderate findings

Locked `electron-builder` version: `26.15.3`. npm currently offers `26.5.0` as the fix, which is a downgrade. The affected chain includes `app-builder-lib`, `dmg-builder`, `@electron/get`, `global-agent`, `roarr`, and `sprintf-js`; npm reports the `sprintf-js` denial-of-service advisory [GHSA-hp3w-g68c-fv3c](https://github.com/advisories/GHSA-hp3w-g68c-fv3c).

Runtime relevance: these packages are development/build tooling and are not shipped in the packaged app. Exposure is limited to developer or CI packaging processes; normal Markdown viewing does not invoke them. These findings remain unresolved until a compatible packaging-chain fix is available; do not downgrade `electron-builder` solely to silence the audit.

## Resolved runtime findings

Mermaid was updated from `12.1.0` to the compatible `12.2.0` release. It now shares Markfly's `katex@0.18.10`; the vulnerable nested `katex@0.16.47` dependency was removed. This resolves the two low runtime findings associated with [GHSA-238p-pmpm-9mq7](https://github.com/advisories/GHSA-238p-pmpm-9mq7).

`npm audit --omit=dev` reports zero findings. Mermaid rendering and KaTeX math are checked before release, alongside the security regression tests and production build.

Re-run both audit commands after dependency changes; registry advisories and fix recommendations can change.
