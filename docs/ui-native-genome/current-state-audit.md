# RCL Native UI Genome v0.1 — Current-State Audit

Audit date: 2026-08-23  
Repository: `xingxuling/RCL`  
Candidate branch: `codex/rcl-native-ui-genome-v0.1`  
Audited baseline: `9093096d4f7a47d713622f8772b433102fda203b`

## Classification

| Capability | Before this candidate | Candidate state | Evidence boundary |
|---|---|---|---|
| `.rcl` native UI syntax | `MISSING` | `PARTIAL` | Full v0.1 candidate lives in the reference parser; the canonical self-host compiler owns only `ui <id> { view <id> {} }`. |
| Canonical Native UI IR | `MISSING` | `PARTIAL` | Versioned, rooted, serializable and validated in `src/ui`; candidate-only until the canonical compiler path owns it. |
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

`VERSION-CONTRACT.json` names `selfhost/compiler-core.rcl` and `selfhost/compiler-main.rcl` as the canonical compiler sources and marks `src/compiler.mjs` as reference-only. A minimal empty-view slice now reaches canonical self-host fixed-point and RBC differential parity. The Counter state/event/layout/style surface does not, so the dual-backend claim still does **not** justify repository-wide promotion from `lowered-execution` to `native-semantic`.
