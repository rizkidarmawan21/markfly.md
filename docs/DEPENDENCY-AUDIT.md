# Dependency audit

Audit snapshot: 2026-10-20, Markfly `0.4.3`.

## Verification

| Scope | Critical | High | Moderate | Low | Total |
| --- | ---: | ---: | ---: | ---: | ---: |
| Full dependency tree | 0 | 0 | 0 | 0 | 0 |
| Production dependencies | 0 | 0 | 0 | 0 | 0 |

Both `npm audit` and `npm audit --omit=dev` report zero findings.

## Resolved build-tool findings

Eight moderate alerts traced to one unpatched `sprintf-js@1.1.3` dependency in the `electron-builder → @electron/get → global-agent → roarr` chain. The `sprintf-js` advisory has no upstream patched release.

Markfly now uses `electron-builder@26.17.0` and pins `@electron/get@5.1.0` through npm overrides. This is the same `@electron/get` version already used by Electron 43. The override removes the old `global-agent → roarr → sprintf-js` chain. Builder and Electron use Node 22, supported by `@electron/get@5`.

The resulting full dependency tree has zero audit findings. Keep the pin while `app-builder-lib` continues requesting `@electron/get@3`; remove it once upstream updates that range.
