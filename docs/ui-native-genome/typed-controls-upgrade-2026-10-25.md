# RCL Native UI Typed Controls v0.3 — implementation evidence

Date: 2026-10-25. Status: CANDIDATE / Research Preview. No production claim.

## Decision and implementation

Introduce checkbox, switch, slider, and select as input kinds in the single canonical Native UI IR, maintaining type-safe bindings and runtime event governance shared by Web and Android:

- `checkbox` / `switch`: `Truth` value and `change(value : Truth)`.
- `slider`: `Number` value and `input(value : Number)` with mandatory finite `min`, `max`, positive `step`; aligned finite grid (at most 100,000 discrete steps). Reject values outside range or off-grid.
- `select`: `Text` value and `change(value : Text)`; `options` must declare a `|`-delimited unique, trimmed 2–64 value set. Reject values not in options.
- All four require value binding, matching typed event signature, and accessibility_label. Disabled/read_only must block both platform controls and canonical event dispatch.
- Web: native checkbox, role=switch, range input, and select/option; typed payloads, dynamic render and visible labels.
- Android: CheckBox / Switch / SeekBar / Spinner, typed listeners, binding updates, guarded events, lifecycle state. Do not grant automatic Reality authority.

## Changed files

`src/ui/ui-controls.mjs` (new), `src/ui/ui-schema.mjs`, `src/ui/ui-compiler.mjs`, `src/ui/ui-validator.mjs`, `src/ui/ui-event.mjs`, `src/ui/web-ui-backend.mjs`, `src/ui/android-ui-backend.mjs`, `examples/native-ui/typed-control-showcase.rcl` (new), `tests/native-ui-typed-controls.test.mjs` (new), this report.

## Verification evidence

- New & previous suite: 13/13 PASS.
- Native UI full `tests/native-ui-*.test.mjs`: 52 PASS, 2 blocked in unrelated pre-existing native event tests due to `RCL_WINDOWS_COMPILER_HOST_REQUIRED` in this Linux sandbox.
- Both backends emit source from the same semantic root; source Web JavaScript parses as a valid script, and canonical Web / Android semantic traces match in scoped tests.
- Actual headless Chromium launch timed out; real Web clicks remain unverified. No Android SDK found; Java compilation, APK install and real device touches unverified.
- Delimiter-style options are bounded, not arbitrarily structured options. Sliders are discrete, not arbitrary analog sampling.
- Browser test diagnostics currently expose state and trace as DOM data attributes. Do not pass actual credentials or production secrets before diagnostics hardening.

## Safety and rollback

Reject invalid types, off-grid numbers, unknown selections, invalid declarations, disabled/read-only events without altering state or committed trace. All changes are additive and can be reverted with a single PR commit. Generated artifacts do not establish device-level completion.
