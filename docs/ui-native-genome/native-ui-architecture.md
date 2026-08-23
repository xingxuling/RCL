# Native UI Architecture

## Decision

The UI semantic boundary is:

```text
.rcl UI declaration
→ RCL UI AST
→ rooted Canonical Native UI IR
├─ Web backend: HTML + CSS + browser runtime
└─ Android backend: native Views + Java + Gradle project
```

The core contains roles, properties, local state, derived state, bindings, canonical events, layout, style/cascade and lifecycle. It contains no `div`, CSS Flex, Android Button, Compose Column or platform permission primitive.

## Modules

- `ui-schema.mjs`: versions, enumerations and property contracts.
- `ui-ir.mjs`: canonical serialization and SHA-256 semantic root.
- `ui-validator.mjs`: format, stable identity, structure and root-integrity validation.
- `ui-reactive.mjs`: canonical expression lowering/evaluation.
- `ui-event.mjs`: event graph, local transaction runtime and semantic trace.
- `ui-layout.mjs`: platform-neutral layout normalization.
- `ui-style.mjs`: theme/selector/cascade resolution.
- `ui-lifecycle.mjs`: canonical lifecycle and restore declarations.
- `web-ui-backend.mjs` and `android-ui-backend.mjs`: platform providers.

## Identity and determinism

Every view node has a required stable `id` and an `identityPath`; duplicate IDs fail compilation. Canonical JSON sorts object keys before hashing. Both lowering reports carry the same `uiProgramRoot`, so backend coincidence is not accepted as same-source proof.

## Authority boundary

Local `set` statements may mutate only declared UI-local state. A `realize` statement emits a `CandidateReality` through an explicit gateway. A handler mixing local mutation and a reality action is rejected, and a reality action without a gateway fails closed. The UI runtime does not own permission, Provider, 4R commit or rejection authority.

## Extension boundary

Navigation, resources and device adaptation are reserved in `extensionPoints` but are null/unimplemented in v0.1. Accessibility currently contains only a stable label. RSL may compile alternate surface syntax to this IR later; the IR itself does not depend on localized keywords.

## Promotion boundary

The JavaScript reference compiler currently owns the candidate syntax. Formal canonical promotion additionally requires the self-host compiler to parse and emit the same UI IR, fixed-point/differential evidence, version-contract changes and a human-reviewed promotion receipt.

