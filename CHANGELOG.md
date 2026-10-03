# Changelog

## 1.0.0 - locally verified 2026-10-03

- Add exact finite binary64 semantic state root v2 and make it the native default, including transaction/projection roots with explicit algorithm IDs.
- Retain explicit v1 and separately identified historical candidate verification.
- Bind user facet names to roots, reject ambiguous typed-layout fields, and reject unsupported/nonfinite root input.
- Rebuild Windows native tools and reproduce Linux native execution and compiler fixed points.
- Unify source and installed CLI entrypoints, Node requirements, source/dependency closure and release packaging on Windows.
- Expand and refresh source-backed Stage0 audit bindings without changing its proxy-only status.
- Preserve research-extension maturity, explicitly replay frozen profiles with their historical algorithm, and retain independent component contracts.
- Pass all 328 test files in two source-bound batches (1683 pass, 0 fail, 2 documented skips), Stage0–40, independent Windows/Linux installations and 32-tool MCP processes.
- Include explicit MCP root negotiation and verified state/binary evidence; exclude Rust build caches from the installable archive.

## Unreleased

### Added

- Native UI Genome v0.1 candidate syntax and rooted canonical UI IR in the JavaScript reference compiler.
- Minimal Native UI syntax/root ownership in the canonical RCL-authored compiler with JS/native fixed-point differential evidence.
- Position-independent semantic-genome roots that bind UI mutations while excluding diagnostic locations and derived caches.
- Platform-neutral reactive state, bindings, canonical events, layout, style/cascade and lifecycle modules.
- Web and Android providers consuming the same UI semantic root.
- Counter cross-backend example, focused tests, real-browser receipt and Android Gradle build receipt.

### Compatibility

- Existing K02 Web and K03 Android companion-spec paths remain available and retain their `lowered-execution` classification.

### Known boundaries

- Full Counter self-host compiler parity and Android device execution remain unverified, so native UI is a candidate rather than a promoted language capability.
