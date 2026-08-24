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
- `ui-device-adaptation.mjs`: width-profile validation, selection and adaptive layout projection.
- `web-ui-backend.mjs` and `android-ui-backend.mjs`: platform providers.

## Identity and determinism

Every view node has a required stable `id` and an `identityPath`; duplicate IDs fail compilation. Canonical JSON sorts object keys before hashing. Both lowering reports carry the same `uiProgramRoot`, so backend coincidence is not accepted as same-source proof.

## Authority boundary

Local `set` statements may mutate only declared UI-local state. A `realize` statement emits a `CandidateReality` through an explicit gateway. A handler mixing local mutation and a reality action is rejected, and a reality action without a gateway fails closed. The UI runtime does not own permission, Provider, 4R commit or rejection authority.

## Extension boundary

Navigation and available-width device adaptation are canonical `extensionPoints` in v0.1. Device profiles use `dp` ranges on the `available-width` axis and may override container layout direction; profile ranges may not overlap. Resources remain null/unimplemented, and accessibility currently contains only a stable label. RSL may compile alternate surface syntax to this IR later; the IR itself does not depend on localized keywords.

## Promotion boundary

The canonical self-host compiler now owns the minimal UI, exact Counter state/derived/lifecycle/theme/style/tree/binding/layout/local-event semantic slice, typed or standard-inferred UI-local parameters, governed `reality-transaction` declarations, fixed width/height intent, canonical in-app navigation and available-width adaptive layout direction with byte-identical fixed-point, differential, mutation, normalization and negative-control evidence. Whole-program validation binds every governed UI rule reference to a declared emergence rule, validates route identities/root-child targets and adaptation profiles/references, and rejects mixed local/reality handlers, multiple transitions or overlapping ranges. Fixed values are non-negative numeric literals and normalize equivalent numeric spellings. Routes lower from one root to Web and Android visibility; width profiles lower from that root to Web media queries and Android `screenWidthDp` orientation logic. This is compile-time semantic ownership only: actual reality execution remains in the external Gateway and yields a `CandidateReality`, never a UI-owned commit. Formal repository-wide promotion still requires resources, broader adaptation and fuller accessibility semantics, Android device evidence, version-contract changes and a human-reviewed promotion receipt.

The UI `semanticRoot` is a versioned semantic-genome hash. The reality `programRoot` binds `{id, semanticRoot}` receipts rather than diagnostic locations or derived caches. This makes roots stable under source relocation without weakening mutation detection.
