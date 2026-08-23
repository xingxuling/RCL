# Changelog

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
