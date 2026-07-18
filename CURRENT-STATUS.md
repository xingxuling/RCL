# Current RCL Status: v0.94.0-alpha.1

- Canonical source: `xingxuling/RCL@main`.
- Verified ceiling: Stage40 native-core RCL self-hosting.
- The repository contains the native-core compiler/VM path and fixed-point artifacts described in the main README.
- Whole-language runtime self-hosting is not claimed. Six Foundation domains plus the three Meta Batch B planes now execute through RBC 1.2 and two `RclVmProviderV1` Native Provider bridges; uncovered and declared-domain runtime remains JavaScript.
- The bridge is explicitly reported as `bridge`, not native Foundation syntax. Its executable is `native/rclfoundation.exe`.
- Downstream copies in RNCS and zhinao are tracked as migration consumers, not as byte-identical sources.
- Machine-readable contract: `VERSION-CONTRACT.json`.
- Verification entrypoint: `npm run verify:version-contract`; the bridge gates are `npm run test:foundation-native-batch-a`, `npm run test:foundation-native-meta-batch-b`, and `npm run conformance:foundation`.

``CONTEXT.md`` is retained as historical handoff material; its prior “Current” heading has been renamed to avoid presenting v0.86 as the current release.
