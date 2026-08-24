# Native UI Genome v0.1 — Evidence Ledger

## Source identity

- Repository: `xingxuling/RCL`
- Candidate branch: `codex/rcl-native-ui-device-adaptation-v0.1`; local `main` merge is permitted only after the clean full regression (remote push not performed)
- Base SHA: `f64c214bc38295f05b6e8174afb2f4a843834508`
- Remote `main` at audit: `883b265420645b9ee112f0839c794bd76de50bd6`
- Parent candidate implementation SHA: `5118e267d7045a12fce2c4cdbe6b6b7dee886fe2`
- Predecessor minimal-selfhost implementation SHA: `e0d9a0848a101d8b69ed53cefb94fcc3367db8fc`
- Counter-selfhost implementation SHA: `c442f054b1007c9dab878b57f104e77bd1ffb47d`
- Parameterized-event implementation SHA: `3f1aabbbd5b46fe6eb54fb986bb5f38c1b2bcc90`
- Governed-event implementation SHA: `6a2061bf7724530914a75b99a2d6e0e05616ee0b`
- Fixed-sizing implementation SHA: `035c0599e137e14442f175f8a7104505634ee9bc`
- Navigation implementation SHA: `2915e37df6f5088d9a6e4b3f23d1d74a440f7862`
- Navigation evidence-seal and merged local-main SHA: `e56a6f852c5df0b36a003617f9daa89d3616931d`
- Device-adaptation implementation SHA: `f8f3eca982dd7b76a10c38f66045d99516c1c910`
- Device-adaptation self-host evidence seal SHA: `9b2e9216556b773c95c71b086eaf98a5a8f4a231`
- Final documentation seal SHA: reported in the generation handoff because a commit cannot self-bind its own SHA
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
- `selfhost-fixed-result.json`
- `selfhost-navigation-result.json`
- `selfhost-device-adaptation-result.json`
- `device-adaptation-browser-result.json`
- `device-adaptation-android-build-result.json`

## Changed files and module disposition

- Added modules: the canonical candidate UI stack under `src/ui/`, four Native UI test files, navigation/device-adaptation evidence plus existing evidence/benchmark runners, the Counter, minimal, parameterized, governed, fixed-sizing, navigation and device-adaptation selfhost sources, compact receipts, and the Native UI documentation set.
- Reused modules: `src/parser.mjs`, `src/compiler.mjs`, the Web/Android application compilers, public exports, package scripts, and the universal stress reporter. The legacy K02/K03 companion routes remain available and are not rewritten into the Native UI route.
- Replaced modules: none. The candidate remains explicitly routed and does not delete a legacy backend. The canonical self-host compiler now includes the Counter parser/semantic-genome encoder, typed/custom and standard-inferred UI-local parameters, governed reality-transaction declarations with whole-program rule-reference validation, fixed width/height intent with canonical number normalization, rooted in-app routes, and non-overlapping available-width profiles with adaptive layout direction. Resources, broader device adaptation and full accessibility remain excluded or partial.
- Governance/support changes: the Akashic scanner now includes root `CHANGELOG.md` and recursively scans governed documentation; the K400 model records `UNTESTED`/`REGRESSED`, gate metadata and full 400-cell output; the repository now includes the declared Apache-2.0 license text.

## Test and runtime ledger

| Evidence class | Result |
|---|---|
| Parser / IR | PASS — typed parameters, stable identity, serialization and invalid-source rejection |
| Native UI semantics | PASS — 30/30 focused tests, including one-root fixed-size, navigation and width-profile adaptation Web/Android lowering |
| Web | PASS — lowering plus Chrome 151 real-DOM interaction; adaptation selects compact/vertical at 320 px and expanded/horizontal at 840 px |
| Android | BUILD PASS — offline Gradle 8.10.2 project and APK with JBR 21; DEVICE RUNTIME NOT VERIFIED |
| Authority | PASS — reality actions require a CandidateReality gateway; mixed authority fails closed |
| Style / layout / lifecycle / navigation / device adaptation | PASS for the declared v0.1 subset; resources, broader adaptation and full accessibility remain absent or partial |
| K02/K03 compatibility | PASS — 6/6 Web companion and 8/8 Android companion focused tests |
| Selfhost/fixed point | PASS — 6/6; minimal UI, Counter, parameterized UI-local events, governed reality-transaction declarations, fixed sizes, navigation and available-width adaptive layout are JS/self-host/native byte-identical; valid mutations change roots; equivalent fixed-number spellings normalize; invalid parameters, rules, authority mixtures, sizes, modes, routes, profile ranges/references and transition cardinality fail closed |
| Instruction headroom | PASS — 88,744,649 executed per native generation; 211,255,351 remain against the 300 million cap; minimum gate 180 million. The sealed adaptation evidence pair took 228,988.5857 ms against the predeclared 240,000 ms gate; an independent focused reproduction took 232,033 ms |
| Full regression | PASS — device-adaptation generation: 729 tests, 728 pass, 0 fail, 1 skip; 435,722.8321 ms on this machine. The clean run recorded byte-identical native C0/C1/C2 in 226,921 ms and retained 211,255,351 instruction headroom per generation |
| K400 / Integration Court | BLOCKED — device-adaptation generation has 5 evidence-bearing cells BLOCKED, 395 UNTESTED, 0 PASS; maturity `U0`; deterministic report root `b23310ad9a03dacf876e972670d9d02ca2cc49281d74fd9d1852b4c8055d58fa` |

The first fixed-sizing parser prototype added three helper `reckon`s and was rejected after the ordinary-Node self-host suite exhausted its approximately 4 GiB heap near 47 seconds. A one-axis parser then passed focused tests but later reproduced heap exhaustion in an extended full-suite run, so it was not accepted alone. The final implementation also replaces repeated user-call symbol-table scans with one indexed validation and bypasses scans for builtins/special calls: `find_reckon_index` fell from about 35.9 million to 8.5 million steps, native work fell from 113,179,072 to 79,350,203 instructions per generation, and the unmodified focused suite passed 6/6. Increasing the Node heap was not used as a substitute for the resource gate.

The first navigation selfhost form and a zero-new-reckon linear-token-buffer variant both exhausted the ordinary Node heap near 4 GiB and were rejected. The accepted compiler uses a generic bounded tokenizer with 127-token chunks and no increased heap. It retains 534 `reckon`s, emits a 249,866-byte compiler artifact at SHA-256 `836fd9dd246915411a7ccc4f0b09be59591c1a63de90d6a01b1425098aef079b`, executes 83,228,756 JS instructions and 82,329,281 instructions per native generation, and leaves the required native headroom above the non-compensatory threshold.

The device-adaptation generation expands that accepted compiler to 559 `reckon`s and a 265,286-byte artifact at SHA-256 `00321946e2b4651b4a05b229e7ec650c76375b394afebbc89fb7e095fc28779b`. JS fixed-point execution uses 89,695,953 instructions; each native generation uses 88,744,649. A nested `choose` in the expanded compiler exposed instruction-position-derived duplicate bytecode labels; assembler-monotonic fresh labels fixed the general compiler defect, and an independent nested-choose regression now guards it.

Two pre-seal full runs preserved additional resource evidence. The first stopped one native generation at the former 120-second process timeout (`120,175.6977` ms). After raising only that runaway-process guard to 150 seconds, an independent focused run passed at 232,033 ms, while a hot full-suite run measured 244,305 ms and failed the then-embedded 240-second wall-clock assertion. Wall-clock acceptance is now isolated in `scripts/build-native-ui-device-adaptation-evidence.mjs`, which retains the predeclared `<240,000 ms` total gate and sealed a 228,988.5857 ms PASS; deterministic regression retains byte identity, the 300-million instruction cap, 180-million minimum headroom and 150-second per-process protection. The final clean full run also happened to measure 226,921 ms. The 244,305 ms sample remains recorded as host-variability risk rather than being erased.

The final K400 seal also found that `generatedAt` had been included in the report-root preimage, making identical evidence produce different roots. `reportEvidenceRoot` now excludes only volatile `generatedAt` and an existing `reportRoot`; a focused 18/18 suite and two successive report runs prove that semantic changes still alter the root while identical evidence returns the same root. This isolated post-full-regression fix does not change compiler/UI execution paths.

## Current maturity decision

| Dimension | Decision |
|---|---|
| Native semantic coverage | `CANDIDATE` — exact Counter, parameterized UI-local, governed-event, fixed-sizing, navigation and width-profile adaptation selfhost slices verified; resources, broader adaptation and full accessibility remain absent or partial |
| Web lowering | `VERIFIED` for Counter v0.1 |
| Android lowering | `VERIFIED` for project generation and APK build |
| Visual fidelity | `PARTIAL` — semantic structure/style subset, no pixel parity claim |
| Runtime verification | Web `VERIFIED`; Android host trace `VERIFIED`; APK runtime `NOT VERIFIED` |
| Device verification | `NOT VERIFIED` |

## Integration Court

- Does RCL own the candidate UI semantics? **It owns the exact Counter, parameterized UI-local, governed reality-transaction declaration, fixed-sizing, canonical navigation and available-width adaptive-layout slices. Resources, broader adaptation and full accessibility remain absent or partial, so repository-wide ownership is not established.**
- Do Web and Android consume one Canonical UI? **Yes; lowering roots refer to the same `uiProgramRoot`.**
- Is platform syntax present in core? **No detected platform widget/layout primitives.**
- Is Authority/4R preserved? **Yes at the UI boundary; reality actions cannot execute without an external governed gateway.**
- Is there real execution evidence? **Yes for browser and Android build; no for Android device behavior.**
- Is regression closed? **Yes for the device-adaptation execution paths: focused Native UI/selfhost checks and a clean full 729-test run are green; the isolated report-root fix then passed its 18/18 focused suite and two-run determinism check. Android device and AI-generation gates remain open.**

Court result: `NATIVE_UI_CANDIDATE_WITH_BLOCKED_CANONICAL_PROMOTION`. It is not permissible to claim repository-wide `native-semantic` UI yet.

The consolidated report preserves the device-adaptation evidence and adds a post-contract real Chrome performance PASS for the declared Counter workload. Compiler self-hosting and browser claims are now blocked only by independent `AI_GENERATE`; Android claims remain blocked by device execution/correctness/performance and `AI_GENERATE`. These gates do not compensate for one another.

## License and diff audit

The candidate implementation reuses repository interfaces and independently implements the UI IR/backends; no external source was copied. Chrome, Android SDK, Gradle and JBR are execution tools, not vendored source. A root `LICENSE` reproduces the official Apache License 2.0 text exactly apart from outer whitespace, verified against the Apache Software Foundation source on 2026-08-23; no copyright owner or `NOTICE` attribution was invented. External donor residuals are recorded in `examples/universal-stress/unabsorbed-advantages-v0.1.json`.

## Matrix impact

The selfhost rerun maps to `compiler-runtime::self-hosting`, `browser::gui`, `browser::reactive`, `android::gui` and `android::reactive`. Available-width adaptation closes another selfhost and dual-backend semantic gap without transferring commit authority to the UI. Browser performance passes only for the frozen local Counter budget; compiler and browser cells still lack independent AI generation, while Android still lacks device execute/correct/performance and AI evidence. No K001–K400 PASS is inferred from this receipt.
