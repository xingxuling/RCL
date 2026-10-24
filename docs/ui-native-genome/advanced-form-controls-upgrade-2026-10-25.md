# RCL Native UI Advanced Form Controls v0.4 — Research Preview Evidence

Date: 2026-10-25. Status: CANDIDATE / Research Preview. Scope: source-level Web/Android projection and shared Native UI runtime. NOT a production release.

## Founder Twin & multi-civilization review

- **Product:** Extend everyday form composition without duplicating semantic control implementations.
- **UX:** Native platform radio groups (single selection), calendar-date input, multiline notes. Controls retain accessibility labels and lock/readonly behavior.
- **Architecture:** Keep canonical RCL `input` and typed bindings/event graph; `input_kind` values `radio`, `date`, `textarea`. No new Reality authority or remote capabilities.
- **Engineering:** Validate static options, initial values, event payloads; Web DOM and Android View are projections of the same IR.
- **Testing:** Isolated negative tests must prove invalid inputs cannot change state.
- **Safety:** No rich HTML injection, account credentials, or external effects. Dates are `YYYY-MM-DD` civil dates (proleptic Gregorian years 0001–9999), not instants or timezones.
- **Integration Court:** Scoped additive changes; preserve old source behavior and v0.3 regression suite.

## Implemented

- `input_kind = "radio"`: required, unique pipe-delimited 2–64 options; `change(value : Text)`; canonical option membership guard; Web `<fieldset>` + named native radios; Android `RadioGroup`/`RadioButton`. Dynamic disabled/readonly disables each child option.
- `input_kind = "date"`: `change(value : Text)` with strict `YYYY-MM-DD` leap-day validation, rejecting impossible dates and year 0000; Web `input[type=date]`; Android native `DatePicker` and `LocalDate` (requires Android API 26+). Static initial bound state checked before UI construction.
- `input_kind = "textarea"`: `input(value : Text)`; Web native `<textarea>`; Android multiline `EditText`; dynamic readonly respected.
- Preserve shared canonical event restrictions; event failures do not commit state; server/Reality permission model unchanged.
- Generated Web script parsing, and same RCL source producing Web/Android projections.

## Changed files

`src/ui/ui-controls.mjs`, `src/ui/ui-validator.mjs`, `src/ui/web-ui-backend.mjs`, `src/ui/android-ui-backend.mjs`, `examples/native-ui/advanced-form-controls.rcl`, `tests/native-ui-advanced-form-controls.test.mjs`, this report.

## Evidence

- New targeted tests: **9/9 PASS**, including positive state transitions, deterministic trace parity, invalid dates (leap year, month/day/year), illegal radio choices, type mismatches, disabled/read-only event guards, initial state validation, HTML/Android lowering structural checks and Web JS parse.
- `node --test --test-concurrency=1 tests/native-ui-*.test.mjs`: **61 PASS / 2 environment-blocked / 63 total**, same two Windows compiler host dependencies (`RCL_WINDOWS_COMPILER_HOST_REQUIRED`) already present in earlier v0.2/v0.3 rounds.
- Chromium headless real-click smoke **not established**: binary startup timed out under this container. Android Java compilation/SDK emulator/on-device install **not established**: no Android SDK/android.jar available. Do not cite generated Activity as installed APK.
- Browser event diagnostics can expose UI state in DOM test attributes, and are not suitable for real secret entry without hardening; existing scope remains unchanged.

## Limitations, rollback, next work

- Radio options use source value as label; friendly label/value pairs and arbitrary option lists are not implemented.
- Date is a civil date in 0001–9999 range, without dynamic min/max, timezone, localization, or range picking.
- Textarea is multiline text, not a rich-text editor or editor with maxlength/form-level schema validation.
- Future: dialog/list/validation and real browser/Android end-to-end certification.
- Rollback: revert the single PR merge commit. Since changes are limited to the seven listed paths, restore prior v0.3 files and delete new example/test/doc. No migrations required.

## Reproduction

```bash
node --test --test-concurrency=1 tests/native-ui-advanced-form-controls.test.mjs
node --test --test-concurrency=1 tests/native-ui-*.test.mjs
```
