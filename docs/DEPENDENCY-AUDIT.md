# Dependency audit

Audit snapshot: 2026-10-11, `package-lock.json` for Markfly `0.4.2`.

## Verification

```bash
npm audit
npm audit --omit=dev
```

Results from the npm registry at audit time:

| Scope | Critical | High | Moderate | Low | Total |
| --- | ---: | ---: | ---: | ---: | ---: |
| Full dependency tree | 0 | 0 | 8 | 2 | 10 |
| Production dependencies | 0 | 0 | 0 | 2 | 2 |

Compatible dependency and lockfile updates are included in the security-hardening change. No forced downgrade was applied.

## Remaining findings

### `electron-builder` packaging chain — 8 moderate findings

Locked `electron-builder` version: `26.15.3`. npm currently offers `26.5.0` as the fix, which is a downgrade. The affected chain includes `app-builder-lib`, `dmg-builder`, `@electron/get`, `global-agent`, `roarr`, and `sprintf-js`; npm reports the `sprintf-js` denial-of-service advisory [GHSA-hp3w-g68c-fv3c](https://github.com/advisories/GHSA-hp3w-g68c-fv3c).

Runtime relevance: these packages are development/build tooling and are not shipped in the packaged app. Exposure is limited to developer or CI packaging processes; normal Markdown viewing does not invoke them. Keep the finding open for a compatible packaging-chain fix; do not downgrade `electron-builder` solely to silence the audit.

### Mermaid's nested KaTeX — 2 low findings

Markfly directly uses `katex@0.18.10`, but locked `mermaid@12.1.0` depends on `mermaid/node_modules/katex@0.16.47`. npm only offers Mermaid `10.8.0` as an automatic fix, a major-version downgrade. The advisory is [GHSA-238p-pmpm-9mq7](https://github.com/advisories/GHSA-238p-pmpm-9mq7).

Runtime relevance: this nested KaTeX is part of Mermaid's rendering path for diagrams supplied by Markdown documents, so it remains reachable at runtime. Markfly uses Mermaid's strict security level and bounds diagram count and source size, but those controls do not remove the vulnerable dependency. Keep this finding visible until Mermaid or its KaTeX dependency can be updated without breaking supported diagrams.

Re-run both audit commands after dependency changes; registry advisories and fix recommendations can change.
