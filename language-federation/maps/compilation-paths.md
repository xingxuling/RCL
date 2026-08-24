# Compilation and Translation Paths v0.1

## Verified in this repository

```text
zh-CN RSL candidate ─┐
                     ├─> ASIL Programming Profile subset ─> RCL candidate program
en-US RSL candidate ─┘
```

The path is `N + M`: each surface targets one semantic profile, and that profile targets RCL once. No direct zh-CN-to-en-US translator exists.

## Existing but not yet federated

- ASIL has executable Meaning Graph, serialization and specialized compilers inside WorldSeed/UPDIA.
- SNLL has its own candidate semantic IR and RNCS proposal bridge; it does not yet target ASIL.
- CSL targets its own IR, OSE shadow and projection backends; it does not yet target ASIL.
- IAL has specifications and bounded task adapters, but no frozen ASIL field map.

## Fast-path rule

No RSL-to-RCL fast path is registered. Any future fast path must show the same ASIL meaning root and RCL semantic root as the canonical path on the frozen corpus and negative cases.
