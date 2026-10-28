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

## Remaining development queue

1. Audit governed-session journal lifecycle (TD-017) and compiler diagnostics
   (TD-019) against current executable owners before choosing the next increment.
2. Prefer concrete capabilities using existing owners over new parallel services.
3. Checkpoint each completed increment locally with only necessary checks.
4. Continue until the six-hour interval finishes or the user redirects/stops it.
