# A3 Version Ledger Contract Closure v0.1

- Status: **VERIFIED**
- Scope: RBC 1.1 / RBC 1.2 legacy receipt closure and current full-suite contract
- Receipt closure root: `3d549ff4e79801b56c434512fc74e4c7f36cff384a5024ceedcab2533eea87b4`
- Receipt inventory: 6 expected / 6 verified / 0 missing / 0 duplicate / 0 stale / 0 altered / 0 replay mismatch

## Original failure

The first full-suite reproduction failed in `tests/self-akashic-record-compiler.test.mjs` with the assertion `scan.counts.versionLedgerCount >= 60`. The observed current scan had 35 version-ledger-bearing records at the first reproduction; after this closure's added evidence documents it has 39. The production self-Akashic specification declares `minVersionLedgerCount = 28`.

Minimal reproduction before the fix:

```text
node --test --test-concurrency=1 tests/self-akashic-record-compiler.test.mjs
4 tests; 3 pass; 1 fail
AssertionError: 35 >= 60
```

The focused reproduction after the fix is:

```text
node --test --test-concurrency=1 tests/self-akashic-record-compiler.test.mjs
4 tests; 4 pass; 0 fail
```

## Root cause

This was a test-assumption drift, not missing history, a stale manifest, a missing receipt, a generated-artifact omission, a component-version mismatch, or a ledger inventory defect. Git history shows the production threshold `28` originated in `2ef6e68`; commit `b1e4cef4` changed the test assertion from `>= 28` to `>= 60` while retaining the production threshold. No current version-contract or RBC 1.1/RBC 1.2 receipt definition was changed.

## Changed files

- `tests/self-akashic-record-compiler.test.mjs`: the test now reads `DEFAULT_SELF_AKASHIC_RECORD_SPEC.thresholds.minVersionLedgerCount` instead of duplicating a stale literal.
- `docs/A3_VERSION_LEDGER_CONTRACT_CLOSURE_v0.1.md`: this closure record.

No legacy source, version history, expected receipt inventory, canonical language, or version-contract definition was deleted or rewritten.

## Before/after contract

| Surface | Before | After | Ruling |
|---|---|---|---|
| Production minimum | 28 | 28 | unchanged authoritative contract |
| Test minimum | hard-coded 60 | imported production minimum 28 | drift removed |
| Current scan | 35 at first reproduction | 39 after closure docs | above authoritative minimum |
| Legacy receipt inventory | 6 expected | 6 verified | unchanged |
| RBC 1.1 / RBC 1.2 | existing definitions | existing definitions | compatibility preserved |

## Replay and final ledger root

The six legacy receipts replay with stable source, bytecode, result, artifact, runtime-version, and RBC-version bindings. The self-Akashic scan now records 540 files, 172 modules, 36 documents, 162 tests, 247 commands, and 39 version-ledger records; its result root is `d5bb29e117668a80b8849b197e1274c7465ce487ac7eb6149a085bdabf584102`.

The final RBC13 evidence ledger binds this closure root, the final full-suite summary, and the unchanged RBC 1.1/RBC 1.2 receipt roots. The final full-suite rerun is `741 total / 739 pass / 0 fail / 2 skip`; A3 admission is **VERIFIED** because the full suite is `0 FAIL`.

Reproduction: `npm run verify:rbc13-legacy-evidence-closure` and `npm test`.
