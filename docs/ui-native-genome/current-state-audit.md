# RCL Native UI Genome v0.1 — Current-State Audit

Audit date: 2026-08-24<br>
Repository: `xingxuling/RCL`<br>
Candidate branch: `codex/rcl-selfhost-headroom-v0.1`<br>
Generation base: `f64c214bc38295f05b6e8174afb2f4a843834508`<br>
Counter-selfhost implementation: `c442f054b1007c9dab878b57f104e77bd1ffb47d`
Parameterized-event implementation: `3f1aabbbd5b46fe6eb54fb986bb5f38c1b2bcc90`
Governed-event implementation: `6a2061bf7724530914a75b99a2d6e0e05616ee0b`
Fixed-sizing implementation: pending implementation commit

## Classification

| Capability | Before this candidate | Candidate state | Evidence boundary |
|---|---|---|---|
| `.rcl` native UI syntax | `MISSING` | `PARTIAL` | The canonical self-host compiler owns the complete Counter slice, typed and standard-inferred UI-local parameters, governed `reality-transaction` declarations and fixed width/height intent; navigation/resource/device-adaptation extensions remain absent. |
| Canonical Native UI IR | `MISSING` | `PARTIAL` | Versioned, rooted, serializable and validated in `src/ui`; the Counter, parameterized UI-local, governed-event and fixed-sizing genomes are self-hosted, while extension semantics and repository-wide ownership are not. |
| Reactive state/binding/event | `LOWERED_ONLY` | `EXISTING` in candidate | Same IR and trace evaluator feed both candidate backends. |
| Platform-neutral layout | `MISSING` | `PARTIAL` | Vertical, horizontal, overlay and grid-like modes; no general constraint solver. |
| Style/cascade | `RESEARCH_ONLY` / Web-local | `PARTIAL` | Theme, role/class/node selector, priority, specificity and inheritance are canonical; not CSS conformance. |
| Canonical lifecycle | `MISSING` | `PARTIAL` | Create/activate/suspend/resume/destroy/restore model and backend mappings exist. |
| Navigation/resources/device adaptation | `MISSING` | `MISSING` with extension points | Schema slots exist; no runtime semantics are claimed. |
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

`VERSION-CONTRACT.json` names `selfhost/compiler-core.rcl` and `selfhost/compiler-main.rcl` as the canonical compiler sources and marks `src/compiler.mjs` as reference-only. The minimal UI, complete Counter slice, typed/custom UI-local parameters, standard signature inference, event-scope expressions, governed `reality-transaction` declarations and fixed width/height intent now reach canonical self-host fixed-point and RBC differential parity. Unknown rule references, mixed-authority handlers, invalid fixed values and unknown size modes fail closed. Runtime execution remains outside compiler/UI authority: an explicit Gateway may receive `CandidateReality`, but the UI cannot commit reality directly. Navigation, resources and device adaptation remain unimplemented extension points, so this still does **not** justify repository-wide promotion from `lowered-execution` to `native-semantic`.
