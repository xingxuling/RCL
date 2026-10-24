# RCL Native UI Component Controls — bounded upgrade

Date: 2026-10-22. Based on the user's archived `RCL-main (4).zip`; the six edited source files had Git blob SHA equality against `xingxuling/RCL@main` when checked. This is a candidate change and has NOT been pushed, merged or registered into K400.

## Goal and design decision

Extend the existing RCL-owned four-role Native UI rather than invent a second Web/Android component grammar. Reuse the current `input` and `action` canonical nodes with semantic properties, preserving one Native UI program root and failing closed before event dispatch.

## New declared component properties

- `input`: `property input_kind = "text" | "email" | "password"` (default `"text"`); value/event type remains `Text`, not a new secure credential or form-validation type.
- `action` and `input`: `property disabled = true/false` or `bind disabled <- Truth_expression`.
- `input`: `property read_only = true/false` or `bind read_only <- Truth_expression`.
- Properties are role/type checked. Unknown input kinds are rejected. Both control constraints participate in the canonical semantic root.

## Canonical runtime and backend behavior

- The canonical event runtime rejects disabled node events, and rejects `input`/`change` events on read-only input nodes, before mutating state, calling a reality gateway, or recording a trace.
- Web lowering emits `type=email/password/text`, `disabled` and `readonly` when static; reactive bindings set `disabled`/`readOnly`, and direct `window.RCLNativeUI.dispatch` requests also perform semantic guards.
- Android lowering emits `EditText.setInputType(...)`, `View.setEnabled(...)`, and retains the initial `KeyListener` to restore editable state when a dynamic `read_only` binding changes. Emitted dispatch methods reject disabled/read-only operations. Generated Android Logcat messages contain state **keys** rather than state **values**.
- Input `value` and `on input(value : Text)` remain Text-only and have no email validation, secure credential storage, submit validation, cross-device behavior proof, or generic form model yet.

## Developer evidence

- `node --test` against the five existing non-host-dependent Native UI suites plus the new component suite: **40 / 40 PASS**.
- New suite `tests/native-ui-component-controls.test.mjs`: **5 / 5 PASS**; includes canonical root and validator, static/dynamic controls, denied-event rollback, Web/Android equality, compile-time negative cases.
- Generated `RCL_UI_Component_Controls_Demo.html` and `MainActivity.java` from the same source; generated inline Web JavaScript passed `node --check`.
- A broader baseline also contains **two environment-blocked tests** requiring the Windows native compiler host (`RCL_WINDOWS_COMPILER_HOST_REQUIRED`); these were blocked before the modification.
- Chromium headless automated interaction timed out in this container; there is **no claim of actual browser interaction PASS**.
- Android APK build, installation, emulator/device touch testing, screen readers and cross-platform visual parity were **not executed**.

## Risks and rollback

- This remains a research-preview UI extension. The password field changes visual input type, but is **not** a secure secrets pipeline: RCL UI state, browser diagnostics and traces can contain submitted data. Never use it for production credentials without a separately reviewed secret-provider design.
- Static canonical accessibility focus order does not yet update with reactive `disabled` binding changes; platform accessibility and focus behavior need dedicated evidence.
- The Android `KeyListener` restoration path is code-generated and unit-inspected, not device-verified.
- Rollback: `git apply -R RCL_UI_Component_Controls_v0.2.patch` from repository root; the six edited source files can revert independently of samples.

## Next integration gate

Re-run Native UI compiler/selfhost parity; browser click/keyboard/screen-reader coverage; Android build, emulator touch and lifecycle parity; and K400 admission where relevant. Do not advance project maturity without passing these gates.
