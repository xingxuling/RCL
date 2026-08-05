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

## Operating rule

No ACTIVE or RESEARCH item may be silently converted into a capability claim. Promotion requires implementation, negative controls, canonical CI and an explicit contract update.
