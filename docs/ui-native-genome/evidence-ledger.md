# Native UI Genome v0.1 — Evidence Ledger

## Source identity

- Repository: `xingxuling/RCL`
- Branch: `codex/rcl-selfhost-headroom-v0.1`
- Base SHA: `f64c214bc38295f05b6e8174afb2f4a843834508`
- Remote `main` at audit: `883b265420645b9ee112f0839c794bd76de50bd6`
- Parent candidate implementation SHA: `5118e267d7045a12fce2c4cdbe6b6b7dee886fe2`
- Predecessor minimal-selfhost implementation SHA: `e0d9a0848a101d8b69ed53cefb94fcc3367db8fc`
- Counter-selfhost implementation SHA: `c442f054b1007c9dab878b57f104e77bd1ffb47d`
- Parameterized-event implementation SHA: `3f1aabbbd5b46fe6eb54fb986bb5f38c1b2bcc90`
- Governed-event implementation SHA: `6a2061bf7724530914a75b99a2d6e0e05616ee0b`
- Evidence-seal SHA: the follow-up commit containing the SHA-bound matrix receipt; reported in the generation handoff because a commit cannot self-bind its own SHA
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
- `selfhost-counter-result.json`
- `selfhost-parameterized-result.json`
- `selfhost-governed-result.json`

## Changed files and module disposition

- Added modules: the canonical candidate UI stack under `src/ui/`, four Native UI test files, four evidence/benchmark runners, the Counter, minimal, parameterized and governed selfhost sources, compact receipts, and the Native UI documentation set.
- Reused modules: `src/parser.mjs`, `src/compiler.mjs`, the Web/Android application compilers, public exports, package scripts, and the universal stress reporter. The legacy K02/K03 companion routes remain available and are not rewritten into the Native UI route.
- Replaced modules: none. The candidate remains explicitly routed and does not delete a legacy backend. The canonical self-host compiler now includes the Counter parser/semantic-genome encoder, typed/custom and standard-inferred UI-local parameters, and governed reality-transaction event declarations with whole-program rule-reference validation. Fixed sizing and wider forms remain excluded.
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
| Selfhost/fixed point | PASS — 6/6; minimal UI, Counter, parameterized UI-local events and governed reality-transaction declarations are JS/self-host/native byte-identical; four Counter mutations and a valid governed-rule rename change roots; invalid parameters, unknown rules and mixed-authority handlers fail closed |
| Instruction headroom | PASS — 112,233,068 executed per native generation; 187,766,932 remain against the 300 million cap; minimum gate 180 million |
| Full regression | PASS — governed-event generation: 718 tests, 717 pass, 0 fail, 1 skip; 443,291.2379 ms on this machine. An initial run hit one transient Windows `EPERM` directory-rename failure; the affected focused suite then passed 3/3 and the complete rerun passed cleanly |
| K400 / Integration Court | BLOCKED — governed-event generation has 5 evidence-bearing cells BLOCKED, 395 UNTESTED, 0 PASS; maturity `U0`; report root `619190511a5103d018010020e40b78eb63220c42012ce415c1c14fd5a08f383d` |

## Current maturity decision

| Dimension | Decision |
|---|---|
| Native semantic coverage | `CANDIDATE` — exact Counter, parameterized UI-local and governed-event selfhost slices verified; fixed sizing and wider UI grammar remain fail-closed/reference-only |
| Web lowering | `VERIFIED` for Counter v0.1 |
| Android lowering | `VERIFIED` for project generation and APK build |
| Visual fidelity | `PARTIAL` — semantic structure/style subset, no pixel parity claim |
| Runtime verification | Web `VERIFIED`; Android host trace `VERIFIED`; APK runtime `NOT VERIFIED` |
| Device verification | `NOT VERIFIED` |

## Integration Court

- Does RCL own the candidate UI semantics? **It owns the exact Counter, parameterized UI-local and governed reality-transaction declaration slices. Fixed sizing and wider candidate forms remain reference-only, so repository-wide ownership is not established.**
- Do Web and Android consume one Canonical UI? **Yes; lowering roots refer to the same `uiProgramRoot`.**
- Is platform syntax present in core? **No detected platform widget/layout primitives.**
- Is Authority/4R preserved? **Yes at the UI boundary; reality actions cannot execute without an external governed gateway.**
- Is there real execution evidence? **Yes for browser and Android build; no for Android device behavior.**
- Is regression closed? **Yes for the current repository suite: focused Native UI/selfhost checks and a clean full 718-test rerun are green. Android device and AI-generation gates remain open.**

Court result: `NATIVE_UI_CANDIDATE_WITH_BLOCKED_CANONICAL_PROMOTION`. It is not permissible to claim repository-wide `native-semantic` UI yet.

The SHA-bound report evaluates `native-ui-genome-v0.1-candidate-5-selfhost-governed` against implementation `6a2061bf7724530914a75b99a2d6e0e05616ee0b`: compiler self-hosting is blocked only by independent `AI_GENERATE`; browser claims remain blocked by performance and `AI_GENERATE`; Android claims remain blocked by device execution/correctness/performance and `AI_GENERATE` (with robustness gaps where declared). These gates do not compensate for one another.

## License and diff audit

The candidate implementation reuses repository interfaces and independently implements the UI IR/backends; no external source was copied. Chrome, Android SDK, Gradle and JBR are execution tools, not vendored source. A root `LICENSE` reproduces the official Apache License 2.0 text exactly apart from outer whitespace, verified against the Apache Software Foundation source on 2026-08-23; no copyright owner or `NOTICE` attribution was invented. External donor residuals are recorded in `examples/universal-stress/unabsorbed-advantages-v0.1.json`.

## Matrix impact

The selfhost rerun maps to `compiler-runtime::self-hosting`, `browser::gui`, `browser::reactive`, `android::gui` and `android::reactive`. Governed-event compilation closes another selfhost gap without transferring commit authority to the UI, but the cells remain `BLOCKED` through independent non-compensatory gates: K01 still lacks independent AI generation; browser performance and AI generation remain unverified; Android still lacks device execute/correct/performance and AI evidence. No K001–K400 PASS is inferred from this receipt.
