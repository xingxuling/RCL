# Native UI Genome v0.1 — Evidence Ledger

## Source identity

- Repository: `xingxuling/RCL`
- Branch: `codex/rcl-native-ui-selfhost-v0.1`
- Base SHA: `d255c4f21c32a4086643a770f1b80c80968d2c37`
- Remote `main` at audit: `883b265420645b9ee112f0839c794bd76de50bd6`
- Parent candidate implementation SHA: `5118e267d7045a12fce2c4cdbe6b6b7dee886fe2`
- Verified selfhost implementation SHA: `e0d9a0848a101d8b69ed53cefb94fcc3367db8fc`
- Evidence-seal SHA: the follow-up commit containing the SHA-bound matrix receipt; report with `git rev-parse HEAD`
- Rollback point: base SHA above

## Civilizational review decisions

| Gate | Goal decision | Affected modules | Main risk | Acceptance condition |
|---|---|---|---|---|
| Founder Twin | absorb cross-platform UI semantics, not platform syntax | parser, UI IR | wrapper mislabeled native | same rooted IR feeds two backends |
| 柳清莲 Gate | keep promotion honest | version contract, selfhost | reference path mistaken for canonical | no promotion before selfhost parity |
| 洞哥 Grounding | require machine-observed outcomes | evidence scripts | synthetic-only proof | real browser + real Gradle build |
| Product | preserve K02/K03 compatibility | app compilers | regression | legacy routes remain selectable |
| UX / Design | stable roles, identity, state projection | schema, style, layout | platform vocabulary leaks | no HTML/Android primitive in core |
| Engineering | smallest runnable genome | `src/ui` | oversized framework | view/state/event/layout/style/lifecycle closed first |
| Code | explicit schemas and failure modes | compiler/validator | silent semantic drift | unknown properties/references fail closed |
| Test | differential same-source proof | tests/evidence | two similar but unrelated apps | same UI root and semantic trace |
| Security | preserve Authority/4R boundary | event runtime | UI bypasses permission | reality action requires explicit gateway |
| Release | candidate-only maturity label | status/docs | overclaim/device gap | separate build/browser/device statuses |

These decisions changed the implementation: companion morphology is forbidden on the native route, content and style properties are separated, mixed-authority handlers are rejected, and canonical promotion is withheld.

## Evidence artifacts

- `canonical-ui-ir.json`
- `web-lowering-report.json`
- `android-lowering-report.json`
- `semantic-trace-web.json`
- `semantic-trace-android.json`
- `browser-runtime-result.json`
- `android-build-result.json`
- `evidence-summary.json`
- `performance-result.json`
- `selfhost-minimal-result.json`

## Changed files and module disposition

- Added modules: the canonical candidate UI stack under `src/ui/`, four Native UI test files, four evidence/benchmark runners, the Counter and minimal selfhost sources, compact receipts, and the Native UI documentation set.
- Reused modules: `src/parser.mjs`, `src/compiler.mjs`, the Web/Android application compilers, public exports, package scripts, and the universal stress reporter. The legacy K02/K03 companion routes remain available and are not rewritten into the Native UI route.
- Replaced modules: none. The candidate remains explicitly routed and does not delete a legacy backend. The canonical self-host compiler is extended only with a fail-closed minimal UI parser/root slice.
- Governance/support changes: the Akashic scanner now includes root `CHANGELOG.md` and recursively scans governed documentation; the K400 model records `UNTESTED`/`REGRESSED`, gate metadata and full 400-cell output; the repository now includes the declared Apache-2.0 license text.

## Test and runtime ledger

| Evidence class | Result |
|---|---|
| Parser / IR | PASS — typed parameters, stable identity, serialization and invalid-source rejection |
| Native UI semantics | PASS — 20/20 focused tests |
| Web | PASS — lowering plus Chrome 151 real-DOM interaction |
| Android | BUILD PASS — Gradle project and APK; DEVICE RUNTIME NOT VERIFIED |
| Authority | PASS — reality actions require a CandidateReality gateway; mixed authority fails closed |
| Style / layout / lifecycle | PASS for the declared v0.1 subset; navigation, resources and device adaptation remain absent |
| K02/K03 compatibility | PASS — 6/6 Web companion and 8/8 Android companion focused tests |
| Selfhost/fixed point | PASS — 6/6; minimal empty-view UI is JS/native byte-identical, expanded Counter fails closed |
| Full regression | PASS — 718 tests, 717 pass, 0 fail, 1 Zig-unavailable skip, 253.7 s, exit 0 |

## Current maturity decision

| Dimension | Decision |
|---|---|
| Native semantic coverage | `CANDIDATE` — minimal empty-view selfhost slice verified; full Counter parity blocked |
| Web lowering | `VERIFIED` for Counter v0.1 |
| Android lowering | `VERIFIED` for project generation and APK build |
| Visual fidelity | `PARTIAL` — semantic structure/style subset, no pixel parity claim |
| Runtime verification | Web `VERIFIED`; Android host trace `VERIFIED`; APK runtime `NOT VERIFIED` |
| Device verification | `NOT VERIFIED` |

## Integration Court

- Does RCL own the candidate UI semantics? **The governed canonical self-host compiler owns the minimal empty-view slice; the reference compiler still owns the full Counter surface.**
- Do Web and Android consume one Canonical UI? **Yes; lowering roots refer to the same `uiProgramRoot`.**
- Is platform syntax present in core? **No detected platform widget/layout primitives.**
- Is Authority/4R preserved? **Yes at the UI boundary; reality actions cannot execute without an external governed gateway.**
- Is there real execution evidence? **Yes for browser and Android build; no for Android device behavior.**
- Is regression closed? **Yes for this generation: 718 tests, 717 pass, 0 fail and 1 Zig-unavailable skip. This does not close full Counter selfhost, Android device or AI-generation gates.**

Court result: `NATIVE_UI_CANDIDATE_WITH_BLOCKED_CANONICAL_PROMOTION`. It is not permissible to claim repository-wide `native-semantic` UI yet.

## License and diff audit

The candidate implementation reuses repository interfaces and independently implements the UI IR/backends; no external source was copied. Chrome, Android SDK, Gradle and JBR are execution tools, not vendored source. A root `LICENSE` reproduces the official Apache License 2.0 text exactly apart from outer whitespace, verified against the Apache Software Foundation source on 2026-08-23; no copyright owner or `NOTICE` attribution was invented. External donor residuals are recorded in `examples/universal-stress/unabsorbed-advantages-v0.1.json`.

## Matrix impact

The selfhost rerun maps to `compiler-runtime::self-hosting`, `browser::gui`, `browser::reactive`, `android::gui` and `android::reactive`. All five remain `BLOCKED`; the generated 400-cell dashboard reports 5 blocked claims and 395 untested cells. K01 remains blocked by independent AI generation; Counter performance and AI generation remain unverified; Android also lacks device execute/correct evidence.
