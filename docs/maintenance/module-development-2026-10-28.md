# RCL module development, 2026-10-28

## Session scope and baseline

User requested six hours of continued RCL module development. Goal created at
2026-10-28 20:24:13 Asia/Shanghai; requested interval ends at 2026-10-29 02:24:13.
This checkpoint records an increment, not completion of the six-hour objective.

- Canonical remote main inspected and fetched: `ed2821516746eb2ba5898b5084ae92cd98c788b1`.
- Clean isolated worktree: `work/RCL-module-development-20261028` in the local project.
- Branch: `codex/rcl-module-development-20261028`.
- Existing `work/RCL-v2-development` retained on its original branch and commit.
- Read-only project `sources/` untouched. No GitHub Actions, publication or deployment requested.
- Local TaoX provider's `FourDevelopmentModeRouter` was actually invoked:
  initial WHOLE_ARTIFACT (score 0.785), then DEEP_DEVELOPMENT (score 0.8675)
  once the cross-backend form-validation bottleneck was established.
  These are deterministic planning recommendations, not execution authority.
- Local Laya mode advisory abstained at confidence 0.0784 (threshold 0.65).

## Increment 1: independent form validation scopes

Previously every guarded submit checked every input in the entire UI. A valid
contact form could not save while an unrelated profile form was empty. Actions
can now declare an immutable Text property:

```rcl
property require_valid_form = true
property validation_scope = "ContactForm"
```

The scope must name an ancestor container of the submitting action. Compilation
and canonical IR validation reject missing/sibling/leaf/empty targets, wrong
types and scopes without a true form guard. Every descendant input in the scope
is checked, including nested, hidden, disabled and read-only inputs; this change
does not silently exempt fields based on presentation. Without the property,
existing global validation remains unchanged. A root scope is explicitly global.
Scope declarations participate in the existing semantic genome and root.

The canonical runtime, emitted Web runtime and generated Android validation all
use the selected subtree. Global validation projections remain global so callers
can still inspect total validity. Web error feedback appears only for fields
whose form has been submitted; editing clears resolved errors through rendering.
JavaScript API `formValidation(scopeId)` allows per-container inspection in the
generated Web runtime. Example: `examples/native-ui/scoped-forms.rcl`.

### Verification

- 23 focused scoped-form, existing form-validation and modal-visibility checks PASS.
- 42 affected parser/IR, typed controls, advanced controls, component controls,
  backend equivalence and native event execution checks PASS.
- `node scripts/verify-native-ui-scoped-forms.mjs`: PASS, ten actual headless
  Chrome DOM interaction assertions, including sibling feedback isolation,
  independent submit and failed-submit state/trace preservation.
- Generated Activity compiled with `javac` against local Android 35 `android.jar`: PASS.
  Android device execution NOT_RUN; source compilation is not device acceptance.
- Reproducible generated HTML, Java/class files and evidence are in
  `output/module-development-20261028/scoped-forms/`. The source-bound summary
  is retained alongside this note as `scoped-forms-verification-2026-10-28.json`.
- Package version and language maturity remain unchanged. No new K400 claim.

## Increment 2: session bytecode feature version

Commit `2a914f2` fixes a discovered native/bootstrap byte mismatch for ruleless
sessions. The native session encoder previously forced RBC 1.3 even when emitted
instructions only required RBC 1.1 or 1.2. It now uses the existing shared
instruction feature detectors, while retaining the session header flag. A focused
check passes five profiles (empty, literal, modulo, source input, transactional
rule), including exact bootstrap bytes and actual native daemon initialization.
The existing session/compiler/CLI/restart suite also passes 14 checks.

## Increment 3: native semantic source positions

The compiler now preserves a diagnostic-only Span at the end of internally parsed
expression nodes; existing semantic fields and canonical expression emission
retain their indexes. Parenthesized expressions retain the inner expression's
location; binary nodes point to the operator. Synthesized nodes keep an explicit
fallback span. Unknown alteration targets retain their target token position.

Unknown names/calls, arity, literal facet mismatch, warrant result types, predicate
operators, builtin/user argument checks and reachable user return errors propagate
the appropriate expression span. Commit `772c0b5` passes 72 final-artifact compiler,
location and warrant checks. The current compiler reaches native C0 == C1 == C2
at 300389 bytes, SHA-256
`964e620258158cf0eaabf3e3e2dc0b61470f44c618a8e519e5605013ee8bc098`.
Evidence: `docs/maintenance/native-semantic-locations-2026-10-28.json`.

The new Unicode diagnostic check found a column mismatch after supplementary
Unicode text. The current core now reuses the already present UTF-16 column
accounting from `selfhost/variants/utf16-columns/compiler.rcl` in `position_after`.
All 27 location checks pass, including CRLF, tabs, Chinese comments, parentheses,
operators, nested function bodies, output preservation and UTF-16 columns after
emoji. Valid supplementary-text programs now match bootstrap bytes/roots too.
The final self-hosted artifact includes this Unicode correction. The full checked-in
example parity collector is running separately; its result is not yet claimed.

Remaining source-position scope: UI declaration/navigation diagnostics, missing
rule-warrant declarations and session unsupported-facet diagnostics still use
synthetic locations. TD-019 therefore remains open. General language type-checker
parity is not expanded by this diagnostic change.

## Increment 4: consistent durable-session backups

The existing native writer now exposes a queued `backup(newDirectory)` operation.
It exports the original source/bytecode and one complete journal prefix into a
fresh directory, followed by a rooted manifest with exact file hashes, identity,
revision, head and state root. Writer lock files are excluded. Existing and nested
destinations reject; interrupted exports remain unacknowledged and leave the live
writer usable. Backup assets are captured before destination creation.

`verifyDurableRealitySessionBackup` checks the manifest/assets, then reuses the
existing full native replay with optional independent reference replay. A false
state claim cannot be admitted merely by recomputing the manifest hash. Caller
backup/head/revision anchors remain distinct from consistency checks derived from
the bundle itself. A backup can be reopened as an independent writable continuation,
preserving historical receipts and request-id retries. Appending makes its original
backup manifest stale; frozen backups should be retained separately.

Public CLI operations are `session backup` and `session backup-verify`, with strict
argument handling and optional external anchors. Documentation is in
`docs/v2.0/session-contract.md`. Nine new checks pass, including actual separate
CLI processes, queued-prefix capture, branching/retry, injected storage failure,
asset drift and manifest tampering. The existing 12 durable/CLI checks also pass
in the scoped 20-check run before the additional separate-process smoke was added.
Local TaoX routing again selects DEEP_DEVELOPMENT (score 0.8325 via bottleneck gate).
TD-017 remains ACTIVE: backups retain full history and do not implement compaction.

## Increment 5: source-backed editor navigation

The existing LSP bridge now indexes source-declared facet references, resolves
definition/hover from an expression or write usage, and returns references with
optional declaration inclusion. Names/types use actual parser token ranges rather
than guessed keyword offsets. The parser's tooling coordinates are stored outside
the canonical AST; parameters, match bindings, strings/comments and UI-local state
do not become facet references. The profile remains a same-document static bridge.

Thirty scoped editor/parser/selfhost checks pass. All 233 example sources were
compared with the committed prior parser: 212 accepted ASTs and 21 rejected-source
diagnostics were identical. See `lsp-facet-references-2026-10-28.md` and
`lsp-parser-sidecar-2026-10-28.json`. The full native example-parity job remains
live independently; its repeated full-compiler target samples are still executing.

## Increment 6: verified cache materialization

Package caching now includes independent integrity verification and reconstruction
into a fresh directory. Reconstruction recompiles through the existing lock owner
and must reproduce the original lock root and package identity. Content objects
are immutable and reused by digest; invalid source packages cannot publish a
successful cache. Default in-project caching remains stable across repetitions.
External-root checks, portable path admission, object hashes and no-overwrite
destinations apply to the new CLI and package APIs.

Nine new checks plus four existing lock/cache/CLI-release regressions pass.
See `package-cache-materialization-2026-10-28.md`. The complete native example
parity collector is still running; no all-examples PASS is inferred from the
bounded checks reported here.

## Increment 7: release metadata and payload integrity

The release verifier now reuses cache integrity checks and binds package lock,
source TOML, cache, target matrix/platforms, target inventories, compatibility,
SBOM and deterministic seed-envelope metadata to the declared release root.
Malformed/missing evidence and symbolic file-tree entries reject with structured
reports. Caller release pins and CLI nonzero failure status are supported; public
seed checksums are explicitly not publisher authentication.

Eleven new controls changed from FAIL to PASS, and all ten existing ecosystem
checks pass, including release reproducibility and real CLI/demo assembly. See
`release-integrity-2026-10-28.md`. Full native example collection remains live.

## Remaining development queue

1. Collect the running complete example-parity result and classify any actual gaps.
2. Continue compiler diagnostic coverage and governed-session journal lifecycle
   (TD-017) using their current executable owners.
3. Prefer concrete capabilities using existing owners over new parallel services.
4. Checkpoint each completed increment locally with only necessary checks.
5. Continue until the six-hour interval finishes or the user redirects/stops it.
