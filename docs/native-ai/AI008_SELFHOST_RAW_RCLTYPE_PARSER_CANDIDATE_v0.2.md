# AI008 / K333: self-hosted raw `.rcltype` parser candidate v0.2

Status: `PASS_SCOPE_BOUND_LOCAL_CANDIDATE`

This slice absorbs the raw typed-module syntax boundary into executable RCL. The
RCL program tokenizes and parses a bounded `.rcltype` module containing module
headers, imports, generic parameters, records, tagged unions, aliases and
interfaces. The native VM executes that parser, emits a deterministic parsed
structure and verifies its native semantic state root.

The candidate is checked against the existing JavaScript parser on the Tensor
typed module and a richer record/union/alias/interface/import corpus. Malformed
record syntax and unknown top-level declarations fail closed at the native
semantic assertion boundary.

## Ownership boundary

- RCL owns the candidate parser source, token/state representation, syntax
  acceptance, deterministic parser root and fail-closed syntax boundary.
- The existing JavaScript type-module kernel remains the reference linker and
  semantic resolver for this slice.
- Generic typed-expression lowering, union construction lowering and fixed-point
  inclusion in the canonical self-host compiler remain open.
- No typed-module-specific VM opcode, provider authority or canonical promotion
  is introduced.

## Evidence boundary

The local test is a bounded candidate replay. It is not evidence of complete
self-host compiler closure, arbitrary `.rcltype` compatibility, Windows/Linux
cross-runtime historical-root migration, canonical promotion, or production
typed-program coverage.

