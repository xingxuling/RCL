# RCL Native UI Genome v0.1 — Current-State Audit

Audit date: 2026-08-24<br>
Repository: `xingxuling/RCL`<br>
Merged branch: local `main` (remote push not performed)<br>
Generation base: `f64c214bc38295f05b6e8174afb2f4a843834508`<br>
Counter-selfhost implementation: `c442f054b1007c9dab878b57f104e77bd1ffb47d`
Parameterized-event implementation: `3f1aabbbd5b46fe6eb54fb986bb5f38c1b2bcc90`
Governed-event implementation: `6a2061bf7724530914a75b99a2d6e0e05616ee0b`
Fixed-sizing implementation: `035c0599e137e14442f175f8a7104505634ee9bc`
Navigation implementation: `2915e37df6f5088d9a6e4b3f23d1d74a440f7862`
Device-adaptation implementation: `f8f3eca982dd7b76a10c38f66045d99516c1c910`

## Classification

| Capability | Before this candidate | Candidate state | Evidence boundary |
|---|---|---|---|
| `.rcl` native UI syntax | `MISSING` | `PARTIAL` | The canonical self-host compiler owns the complete Counter slice, typed and standard-inferred UI-local parameters, governed `reality-transaction` declarations, fixed width/height intent, in-app routes and available-width adaptation profiles; resource and broader adaptation extensions remain absent. |
| Canonical Native UI IR | `MISSING` | `PARTIAL` | Versioned, rooted, serializable and validated in `src/ui`; the Counter, parameterized UI-local, governed-event, fixed-sizing, navigation and width-profile adaptation genomes are self-hosted, while remaining extension semantics and repository-wide ownership are not. |
| Reactive state/binding/event | `LOWERED_ONLY` | `EXISTING` in candidate | Same IR and trace evaluator feed both candidate backends. |
| Platform-neutral layout | `MISSING` | `PARTIAL` | Vertical, horizontal, overlay and grid-like modes; no general constraint solver. |
| Style/cascade | `RESEARCH_ONLY` / Web-local | `PARTIAL` | Theme, role/class/node selector, priority, specificity and inheritance are canonical; not CSS conformance. |
| Canonical lifecycle | `MISSING` | `PARTIAL` | Create/activate/suspend/resume/destroy/restore model and backend mappings exist. |
| Navigation | `MISSING` | `PARTIAL` | Canonical initial route, route-to-root-child targets, atomic UI-local navigation and Web/Android visibility lowering are verified; browser navigation performance and Android device behavior are not. |
| Resources/device adaptation | `MISSING` | `PARTIAL` | Non-overlapping available-width profiles deterministically select vertical/horizontal container layout, with real Chrome behavior and Android build evidence. Resources, other adaptation axes and Android device behavior remain unverified. |
| Accessibility | `LOWERED_ONLY` | `PARTIAL` | Stable accessible label only; no focus or accessibility tree model. |
| K02 Web UI | `LOWERED_ONLY` | legacy retained + candidate native path | Legacy companion morphology remains compatible; native path rejects supplied morphology. |
| K03 Android UI | `LOWERED_ONLY` | legacy retained + candidate native path | Native path consumes the same UI root; real APK build is verified, device execution is not. |

## Existing reality

K02 previously combined RCL-owned application state and governed rules with an external Web companion document/style manifest. K03 similarly combined RCL application semantics with an Android-only screen specification. Both were honest `lowered-execution` paths, not native UI semantics.

No shared Reality Markup, DOM, CSS cascade or Android UI kernel existed that could be promoted without adaptation. The Web and Android compilers also carried separate UI morphology structures and duplicated portions of expression/rule lowering.

## Reuse / adapt / keep separate

- `REUSE`: the RCL expression parser, top-level reality parser, rule identities, K02 browser artifact boundary, K03 Gradle/Activity project boundary, and existing compatibility paths.
- `ADAPT`: UI declarations are compiled into one `rcl.native-ui.program.v0.1` IR before either backend; Web and Android compilers select this route only when a native UI declaration exists.
- `KEEP_SEPARATE`: HTML/DOM/CSS emission, Android View/Java/Gradle emission, browser event names, Android lifecycle callbacks and platform resource details.
- `REPLACE LATER`: duplicated legacy application-expression and authority lowering should move behind shared kernels only after differential tests preserve K02/K03 behavior.

## Canonical-source warning

`VERSION-CONTRACT.json` names `selfhost/compiler-core.rcl` and `selfhost/compiler-main.rcl` as the canonical compiler sources and marks `src/compiler.mjs` as reference-only. The minimal UI, complete Counter slice, typed/custom UI-local parameters, standard signature inference, event-scope expressions, governed `reality-transaction` declarations, fixed width/height intent, canonical in-app navigation and available-width adaptive layout direction now reach canonical self-host fixed-point and RBC differential parity. Unknown rule references, mixed-authority handlers, invalid fixed values, unknown size modes, invalid route references/targets, multiple transitions, duplicate/overlapping profiles and unknown adaptation references fail closed. Runtime execution remains outside compiler/UI authority: an explicit Gateway may receive `CandidateReality`, but the UI cannot commit reality directly. Resources, broader device adaptation and full accessibility remain incomplete, and Android device behavior is unverified, so this still does **not** justify repository-wide promotion from `lowered-execution` to `native-semantic`.
