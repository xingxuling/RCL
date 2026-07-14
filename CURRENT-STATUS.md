# Current RCL Status: v0.94.0-alpha.1

- Canonical source: `xingxuling/RCL@main`.
- Verified ceiling: Stage40 native-core RCL self-hosting.
- The repository contains the native-core compiler/VM path and fixed-point artifacts described in the main README.
- Whole-language runtime self-hosting is not claimed; advanced domain runtime remains JavaScript.
- Downstream copies in RNCS and zhinao are tracked as migration consumers, not as byte-identical sources.
- Machine-readable contract: `VERSION-CONTRACT.json`.
- Verification entrypoint: `npm run verify:version-contract`; full checks remain `npm test` and the self-host verification scripts.

``CONTEXT.md`` is retained as historical handoff material; its prior “Current” heading has been renamed to avoid presenting v0.86 as the current release.
