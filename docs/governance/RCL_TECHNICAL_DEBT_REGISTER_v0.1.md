# RCL Technical Debt Register v0.1

## Purpose

This register separates verified closure, active engineering debt, platform blockers and deliberately deferred research. An item is not considered resolved merely because a document or candidate implementation exists.

## Status classes

- `RESOLVED`: implemented on canonical `main` with executable evidence.
- `ACTIVE`: accepted engineering debt with a concrete closure path.
- `BLOCKED`: closure depends on authority or infrastructure not available to the repository workflow.
- `RESEARCH`: requires a new versioned design rather than an unreviewed compatibility change.

## Register

| ID | Status | Area | Debt | Closure evidence or next gate |
|---|---|---|---|---|
| TD-001 | RESOLVED | Repository authority | Canonical branch, version and claim boundaries were not machine-enforced. | `VERSION-CONTRACT.json`, repository authority workflow and canonical verification. |
| TD-002 | RESOLVED | Native authority | Native execution returned state without an independently verifiable semantic authority root. | `rcl.semantic-state-root.v1`, strict verifier, native producer, negative controls and rebuilt Windows distribution. |
| TD-003 | RESOLVED | Version semantics | Package, VM, ABI and authority-algorithm versions could be mistaken for one release number. | `COMPONENT-VERSIONS.json` plus source-backed verification. |
| TD-004 | RESOLVED | Package metadata | The top-level npm description was captured by one v0.94 feature and omitted canonical project links. | Package metadata normalization enforced by `verify-version-contract.mjs`. |
| TD-005 | RESOLVED | Downstream provenance | RNCS and Zhinao copies were named but their drift and byte-identity boundaries were not independently classified. | `DOWNSTREAM-CONSUMERS.json`; downstream repositories still require their own contract PRs. |
| TD-006 | BLOCKED | GitHub host governance | `main` is not protected by a GitHub ruleset. | Issue #26; requires repository Administration permission. |
| TD-007 | ACTIVE | Downstream integration | RNCS embedded RCL lacks `RCL-UPSTREAM.json`. | Add provenance contract, classify extension delta, run repository-native tests. |
| TD-008 | ACTIVE | Downstream integration | Zhinao vendor snapshot records Stage39 and an obsolete canonical commit. | Mark stale immediately, then execute declared synchronization and rebuild evidence. |
| TD-009 | RESEARCH | Semantic hashing | C `%.15g` and ECMAScript number serialization do not yet have a formally versioned cross-platform canonical-number specification. | Differential numeric corpus across Linux/Windows/JS; either prove v1 equivalence over the admitted domain or introduce a new algorithm version. |
| TD-010 | RESEARCH | Typed references | `rcl.semantic-state-root.v1` preserves raw typed-reference object identifiers, so allocation-order-independent graph identity is not claimed. | Design graph-canonical typed-reference roots as a separately versioned algorithm with aliasing and cycle tests. |
| TD-011 | ACTIVE | Release engineering | Published prerelease artifacts predate the current semantic-root and authority-contract work. | Produce a fresh release candidate only after canonical CI, package verification and downstream compatibility notes pass. |
| TD-012 | ACTIVE | Branch hygiene | Historical feature branches remain numerous and are not classified as retained evidence, merged candidates or disposable branches. | Generate a branch inventory, preserve named evidence anchors, then delete only branches proven merged or superseded. |

## 2026-10-12 session maintenance delta

The original register rows above retain their historical scope; this scoped
maintenance does not re-audit every earlier platform/governance item. The current
package stays 2.0.0. See `docs/maintenance/session-integrity-2026-10-12.json` for
source-bound local checks; hosted CI is NOT_RUN_USER_INSTRUCTION.

| ID | Status | Area | Debt | Closure evidence or next gate |
|---|---|---|---|---|
| TD-013 | RESOLVED | Native session integrity | Invalid source/record/root evidence did not reliably close the peer or poison a durable writer. | Mandatory reply binding, genuine-VM fault controls, transport-death controls and safe reopen/retry. |
| TD-014 | RESOLVED | Request capture | Queued durable requests could observe later caller mutations. | Synchronous normalization/identity capture and mutable-request regression. |
| TD-015 | RESOLVED | CLI admission | Trusted history pins were unavailable and unknown flags could be ignored. | Anchored invoke/inspect/verify/recover and strict flag admission before mutation. |
| TD-016 | RESOLVED | Session receipts | Repeated alterations had inconsistent reference/native receipt lists. | Canonical per-field session changes and native/reference durable restart parity. |
| TD-017 | ACTIVE | Journal lifecycle | Full-prefix replay is bounded to 64 MiB / 10,000 commands with no compaction/migration. | Versioned checkpoint admission preserving source/state binding, writer ownership and trusted history anchors. |
| TD-018 | RESOLVED | Compiler admission | Conditional warrants omitted reference/type validation in the RCL-authored compiler. | Shared RCL predicate admission, direct native compiler rejection controls, valid-program byte/runtime parity and a rebuilt native fixed point; `docs/maintenance/warrant-compiler-admission-2026-10-12.json`. |
| TD-019 | ACTIVE | Compiler diagnostics | Semantic errors use synthetic 1:1 spans despite carrying specific diagnostic/context text. | Preserve actual token locations in the internal AST without changing admitted program roots, then verify source-position diagnostics. |

## Operating rule for the historical register

### 2026-10-28 source-position progress

TD-019 remains ACTIVE. The RCL-authored compiler now retains internal expression
and alteration-target spans and uses them for reference/call admission, literal
facet mismatches and conditional-warrant type diagnostics. Operator errors point
to the operator; reachable predicate return errors point to the function body.
UTF-16 columns after supplementary Unicode text reuse the existing column-profile
mechanism. The current compiler reaches a byte-identical native C0/C1/C2 fixed
point and passes 72 targeted compiler/location/warrant checks. See
`docs/maintenance/native-semantic-locations-2026-10-28.json`.

UI declaration/navigation diagnostics, missing rule-warrant declarations and
unsupported session-facet errors used synthetic locations at that checkpoint. This maintenance
does not mark all semantic diagnostics complete or promote whole-language maturity.

### 2026-10-28 session facet diagnostic progress

The direct RCL-authored session compiler now reports retained facet declaration
positions for unsupported session types. Six new location/rejection cases and
three existing session compiler cases pass. The public session compilation API
continues to perform reference preflight first. See
`docs/maintenance/session-compiler-locations-2026-10-28.json`. TD-019 remains ACTIVE
for UI tree/navigation and missing-warrant diagnostic locations; this scoped fix
does not establish complete native diagnostic parity.

No ACTIVE or RESEARCH item may be silently converted into a capability claim. Promotion requires implementation, negative controls, canonical CI and an explicit contract update.

### 2026-10-28 reference equality discrepancy

| ID | Status | Area | Debt | Closure evidence or next gate |
|---|---|---|---|---|
| TD-020 | ACTIVE | Reference value equality | `src/quantity.mjs` uses object identity for Sequence equality while the native VM compares elements recursively. Equal independently built `[1, 2, 1, 2]` values compare false in the reference interpreter and true in both the pre-change and current native VM. | Define shared per-value equality semantics, preserve quantity and typed-reference identity contracts, and add source-level parity and unequal-value controls. The persistent-concat change retains native equality and records ordered storage parity separately; see `docs/maintenance/native-persistent-concat-2026-10-28.json`. |
