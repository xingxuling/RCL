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

## Increment 8: complete target manifest and payload verification

New packages bind their README and complete payload inventory, validate their own
manifest root, and independently recompile source to check bytecode identity.
Generated aggregate/Android diagnostic files are explicitly unbound. Legacy v0.24
packages retain a reported unbound README profile rather than a false new-profile
claim. CLI verification now enforces caller manifest pins and nonzero rejection.

Release matrices bind the semantic manifest metadata of all eight target packages,
including the four not selected in platform rows. Informational machine paths and
the established Android diagnostic are excluded from semantic identity, preserving
cross-directory release reproducibility. Eight new checks and thirty package,
RCLApp, release and CLI consumer checks pass. See
`package-manifest-integrity-2026-10-28.md`.

## Full native example collector result

The original, unchanged-budget collector has finished: artifact parity true,
151 exact matches, 40 unsupported and 42 failures across all 233 source files.
The failures comprise two typed-UI event parameter rejections and 40 timeouts
representing seven unique full-compiler sources. Twelve environment aliases repeat
each of three candidate-source hashes; the other four sources occur once each.
These are actual failures under the collector's 60-second target limit, not PASS
or new K400 evidence. Source-hash grouping is retained in
`output/module-development-20261028/example-failure-groups.json`; the full original
result is `output/selfhost/example-parity.json`.

## Increment 9: native typed UI compiler

The prior `ed28215` compiler reproduces both typed-UI parameter failures. It also
reproduces a 60-second timeout for the native complete-compiler fixture; this
single baseline timeout is not evidence for all seven distinct large sources.
The probe is retained in
`output/module-development-20261028/example-baseline-probe.json`.

The candidate RCL compiler resolves input/change parameter types after the entire
node is parsed, so property order and omitted parameter types work for Truth,
Number and Text controls. It preserves exact bootstrap bytes for six current
typed/form/date/modal/component fixtures. Static properties and bindings, required
value/label/change declarations, option lists, slider ranges, form length bounds,
Gregorian date/radio initials and UI expression operand types now have native
admission checks. Non-ASCII TrimString whitespace at option edges is checked
explicitly because the existing native trim builtin is ASCII-oriented.

The final C0/C1/C2 build is byte-identical at 336769 bytes. All 99 final-artifact
checks pass, including the 27 new control checks and existing location, toolchain
and warrant admission checks. The compiler artifact is updated locally. One
earlier owned build was deliberately stopped when the Unicode edge gap was found;
only the subsequent successful build is evidence. See
`native-ui-selfhost-controls-2026-10-28.json` for source hashes and scope.

Native UI admission is still bounded. Source audit also identified initial-state
and derived-declaration typing/uniqueness checks as follow-up work; full reference
type-checker parity is not claimed by these control checks.

## Increment 10: source-bound parity collection

The collector snapshots the admitted compiler, accepts explicit source/report/
budget selection and reuses one actual result for identical source/reference-byte
hashes. Alias rows identify evidence reuse and retain original-budget outcomes.
Four scoped CLI checks pass. The completed full run on the Increment 9 compiler
has 153 matches, 40 unsupported and 40 timeout failures, with 120 native attempts
and 73 reused alias results. The original 151/40/42 report is retained. See
`selfhost-parity-collection-2026-10-28.md` for interpretation and report boundaries.

## Increment 11: reactive UI declarations

Nineteen native/reference checks reproduced thirteen missing rejection cases:
state literal/type admission, reactive identity collisions, derived result types
and dependency cycles. Candidate validation reuses existing expression typing and
a memoized dependency traversal. The nineteen new checks plus twenty-seven prior
control checks pass. The final native build has C0=C1=C2 at 343089 bytes, and all
122 final-artifact compiler/control/location/warrant/tooling checks pass. Shared
dependency diamonds and a 36-node DAG are included; broader UI schema parity
remains unclaimed. See `native-ui-reactivity-2026-10-28.json`.

## Increment 12: paginated durable receipt history

The durable session exposes queued history pages with receipt-chain bounds,
current head/state roots, a page checksum and optional head pins. Forecast records
and idempotent retries retain their established semantics. Returned entries are
detached copies and reads do not append or rewrite the journal. The public CLI
supports strict history-only pagination flags. Six new checks pass, including
native restart and a separate public CLI process; seventeen existing durable and
backup checks also passed. TD-017 remains ACTIVE. See
`session-history-2026-10-28.md`.

## Increment 13: facet usage semantic coloring

The static editor bridge now emits source-backed read/write tokens alongside
declarations, with declaration/modification modifiers. Qualified paths use actual
lexer fragments, including paths separated across lines or comments. Four new
protocol/namespace/coordinate checks and sixteen existing editor checks pass.
This remains static bridge evidence, without a running editor/server claim. See
`lsp-semantic-usage-tokens-2026-10-28.md`.

## Increment 14: native UI tree admission

The local TaoX FourDevelopmentModeRouter selected DEEP_DEVELOPMENT (0.905) for the
source-audited UI tree admission bottleneck. Twenty-five native/reference cases
reproduced twenty-two absent rejections covering node identity, content/event
requirements, ancestor form scopes and bounded modal structure. Candidate native
validation passes all twenty-five plus forty-six prior UI compiler checks. The
final native build has C0=C1=C2 at 349965 bytes; all 156 scoped final-artifact
compiler/UI/location/warrant/session/tooling checks pass. See
`native-ui-tree-admission-2026-10-28.json`.

The seven distinct large-source timeout cases have now also been tested with the
pre-development `ed28215` compiler. All seven timed out at 60000 ms. This is prior
baseline failure evidence, not a performance fix. See the source-bound baseline
summary and original raw report.

## Increment 15: atomic canonical UI restoration

Canonical lifecycle restore now stages all selected fields, reads each snapshot
value once and commits only after complete validation. Later invalid fields or
read exceptions cannot leave earlier fields restored. Four new checks and sixteen
existing runtime/style/layout/backend semantic checks pass. The affected owner is
the canonical runtime; generated platform persistence acceptance is not claimed.
See `ui-atomic-restore-2026-10-28.md`.

## Increment 16: native session facet diagnostic locations

The RCL-authored session compiler now reports its existing facet declaration
coordinates for unsupported facet types. Six direct native rejection/location
cases changed from FAIL to PASS; nine scoped session compiler tests pass with
accepted target parity and daemon execution retained. The public API's bootstrap
preflight remains distinct. See `session-compiler-locations-2026-10-28.md`.

## Increment 17: bound replay cursor navigation

The existing trace debugger now admits session/trace roots and reconstructed
frame/window bindings before producing steps. A private cursor advances across
repeated calls, supports reverse pause navigation and resumes serialized bound
cursor checkpoints. Invalid commands/origins fail before reports or cursor
mutation. The static DAP request plan maps stepBack/reverseContinue to these
commands. Prototype-like facet watches no longer observe inherited properties.
Five pre-change integrity controls failed; fifteen new and twenty-four existing
debugger/IDE/profiler checks now pass. The public demo also passes. This is recorded
trace navigation, with no live VM reversal or DAP server claim. See
`debug-replay-cursor-2026-10-28.md`.

## Increment 18: linear compiler byte-stream accumulation

Phase profiling isolated repeated whole-prefix copies in string/number/instruction
encoding. Three calls now reuse the compiler's persistent append helper. Other
small pilot changes were not adopted. The final native C0=C1=C2 artifact is
349965 bytes; all 156 affected checks pass. All seven formerly timed-out complete
compiler sources now match bootstrap bytes within roughly 2.11–2.25 seconds.
The full 233-source collector retains the 60000-ms budget and reports 193 matches,
40 unsupported and zero failures (120 native attempts, 73 reused alias results).
Historical failures remain retained. See `selfhost-linear-encoder-2026-10-28.json`.

## Increment 19: native rule host calls

Rule-level host calls now retain canonical metadata, argument/target data, exact
pool order, instruction addresses and provider-source stores through the existing
RCL compiler. The direct RCL session compiler rejects these external effects.
An actual pre-change Number-target run exposed native ABI type drift; bootstrap
and RCL native admission now both require Text response targets. Eighteen new
cases and 160 affected existing checks pass, including local provider execution.
The final C0=C1=C2 artifact is 362965 bytes. The full 233-source collector at the
original 60000-ms budget now has 195 matches, 38 reference compile rejections and
zero failures (122 native attempts, 73 reused aliases). See
`native-rule-host-calls-2026-10-28.json`.

## Remaining development queue

1. Continue bounded compiler/UI diagnostic and lifecycle admission after the
   completed native UI tree fixed point and final-artifact checks.
2. Continue direct native session pure-profile and compiler admission checks using
   the existing reference contract. Rule-level host-call exclusions and the seven
   large-source timeouts are resolved in the current source-bound collector run;
   historical reports retain their original outcome.
3. Continue compiler diagnostic coverage and governed-session journal lifecycle
   (TD-017) using their current executable owners.
4. Prefer concrete capabilities using existing owners over new parallel services.
5. Checkpoint each completed increment locally with only necessary checks.
6. Continue until the six-hour interval finishes or the user redirects/stops it.
