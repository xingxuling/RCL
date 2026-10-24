# RCL Native UI v0.5 — bounded form validation and guarded submit

**Research Preview / candidate.** This change is intended for the RCL `main` branch following UI v0.4 (PR #266). It is not a claim of production-grade credential handling or complete Form API parity.

## Goal and owner boundaries

- Product/UX: a real form can be incomplete during editing, show errors on attempted submit, and prevent invalid submission.
- Shared semantic owner: `src/ui/ui-controls.mjs`, `ui-event.mjs`, `ui-schema.mjs`. Rendering on Web and Android must not be the sole gate.
- Source rules: `property required = true`, `property min_length = N`, `property max_length = N` for compatible input kinds; `property require_valid_form = true` for an `action` with `on activate`.
- Built-in email format: bounded ASCII-like single-address shape, **not** RFC-5322 compliance, DNS lookup, or identity verification. Length uses Unicode code points, not grapheme clusters.
- Compiler rejects non-integer, negative, >10000, reversed length bounds, inappropriate control kinds, missing bound values, and wrong literal types.
- Runtime: `projection().validation` reports `{valid, fields}` without user-entered values; a guarded activation rejects atomically with `RCL_UI_FORM_INVALID` before mutations, reality authority, or trace commits.
- Web: conditional field feedback via `aria-invalid` + status nodes, visible after attempted submit; JavaScript dispatch independently validates.
- Android: `rclFieldError` + `rclFormValidation` generated into native Activity; submit blocked and Android TextView/EditText error + generic Toast on failed submit. No user input is included in exception messages.

## Verification in this container

- `node --test --test-concurrency=1 tests/native-ui-*.test.mjs`: **70 pass / 2 fail due to existing `RCL_WINDOWS_COMPILER_HOST_REQUIRED`**, total 72.
- `node --test tests/native-ui-form-validation.test.mjs`: **9/9 pass**, includes initial blank form, rejection without state changes, successful submit, Unicode lengths, malformed compiler contracts, source tamper gate, Web JS parsing and Android generated source checks.
- `git diff --check`: pass.
- Chromium Playwright: local file page blocked by administrator; subsequent HTML injection run timed out. **No browser click pass claimed.**
- Android: generated Java Activity inspected including escaped Java regex, no SDK/android.jar/real APK installed: **native compile / device tests not claimed**.

## Risks and rollback

1. All fields on the page with validation semantics participate in a single form; multiple independent form scopes are **not** implemented. Do not promote this as multi-form composition.
2. No dynamic validation rules, async validation, regex profiles, localization, network transport, HTML autofill, server-backed credentials, or secret handling are validated.
3. Existing Web test harness exposes state in `dataset.rclState` and a global runtime for test observability. Do not use it for production secrets.
4. Existing tests relying on `trace[]` event record shape remain compatible. The new validation summary exists in projection and top-level semantic trace only.
5. Revert the single v0.5 PR to restore prior behavior. No database migration is involved.

## Suggested next organ

Dynamic list / Dialog / component composition with a documented identity and scoped state policy, after browser/device validation is available.
