# RCL Repository Authority Contract v0.1

## Purpose

This contract maps RCL's reality-transaction principles onto repository operations so that the GitHub host cannot silently bypass the language's own authority and evidence model.

## Repository semantics

| Repository object | RCL meaning |
|---|---|
| `main` | committed canonical reality |
| feature branch | isolated candidate reality |
| pull request | proposed Reality Transaction |
| required workflow | evidence and invariant gate |
| review | authority grant |
| merge | commit |
| revert | rollback |
| release | deliverable Fruit |
| version contract | machine-readable authority declaration |

## Mandatory invariants

1. `package.json`, `VERSION-CONTRACT.json`, and `CURRENT-STATUS.md` must name the same package version.
2. `main` is the sole canonical branch.
3. Native-core self-hosting must not be expanded into a whole-language runtime self-hosting claim without new evidence.
4. Provider bridges, reference-runtime paths, demos, candidates and downstream copies must preserve their declared authority class.
5. Changes to native sources or derived binaries must bind source SHA, artifact hashes and parity evidence.
6. A pull request must pass both `RCL Canonical Verification` and `RCL Authority Contract` before merge.
7. Direct pushes, force pushes and deletion of `main` are forbidden by the target GitHub protection policy.

## Target branch protection

The repository administrator must configure `main` with:

- pull requests required before merge;
- required status checks: `RCL Canonical Verification / verify` and `RCL Authority Contract / verify-authority`;
- branch must be up to date before merge;
- force pushes disabled;
- branch deletion disabled;
- conversation resolution required;
- CODEOWNERS review required where the account/plan supports it.

The repository-level files in this change establish the auditable contract and CI gates. GitHub-host enforcement remains a platform setting and must be enabled separately through repository administration.

## Native semantic authority migration

The old `agent/advanced-runtime-rcl` branch is not a merge source. Its `rcl.semantic-state-root.v1` work must be migrated onto current `main` as a focused change:

1. port semantic serialization into the current native VM;
2. emit `stateRootAlgorithm` and `stateRoot` from the native executable;
3. independently recompute the semantic root in the JavaScript wrapper;
4. reject algorithm or root mismatch;
5. add tamper, field-order, type-change and cross-platform parity tests;
6. rebuild native artifacts from the current branch;
7. update source and artifact manifests together.

No prebuilt binary from the old branch is admissible as current evidence.
