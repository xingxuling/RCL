# K08-G Native Autodiff Integration Court

Status: `ENGINE_E2_AUTODIFF_CANDIDATE_GITHUB_REPLAY_BOUND`

## Reality Audit

- Baseline: GitHub `main` at `10e87bf00bcd2530bc7c3f2df02b02ca9882841c`.
- Existing truth: canonical Tensor/Storage separation, generic Tensor SSA Plan, Rust CPU Provider, liveness reclamation, borrowed execution and General MLP Tensor lowering were already present.
- Confirmed gap: `RCL_GAP_AI_002`; the only training gradients were bounded hand-written two-layer backprop.
- Candidate source commit: `3132b81d9e0b7b7788aaf4b23457656c559b9793`.

## Semantic ownership and language federation

| Concern | Canonical owner | Execution/oracle role |
|---|---|---|
| TensorValue, Parameter, Operation, ComputationGraph | RCL Autodiff Genome | Rust stores and executes the graph |
| GradientIdentity, BackwardEdge, StopGradient | RCL Autodiff Genome | Rust validates and realizes reverse traversal |
| GradientAccumulator | RCL Autodiff Genome | Rust performs finite shape-checked accumulation |
| Batch SGD intent | existing RCL General MLP contract | Rust performs the bounded update loop |
| Analytic/manual comparison | none; oracle only | retained JS/RCL hand-written backward |
| Finite difference | none; oracle only | independent JavaScript central difference |

No Python, NumPy, PyTorch, TensorFlow, JAX or hosted model participates in training. Rust remains an Execution Organ and does not receive commit/promotion authority.

## Multi-civilization gates

- Founder Twin: accepted general learnable-system primitives; rejected task/model-special backward operations.
- 柳清莲 Gate: candidate-only status; no ENGINE-E3/Transformer/Tiny-LM or K400 promotion.
- 洞哥 Grounding: exact current source, executable Rust path, native RCL Genome execution and frozen numeric tolerances.
- Product: General MLP dependency moves from hand-written backward to reusable graph Autodiff.
- UX: not applicable; no user-facing UI change.
- Engineering: public Tensor request formats remain compatible; new formats are additive and fail closed.
- Code: no `unsafe`, new dependency or model-specific opcode.
- Test: positive, negative, boundary, analytic, finite-difference, deterministic, checkpoint and regression coverage.
- Security: graph, parameter, step, node-step, allocation, finite-value and identity ceilings remain explicit.
- Release: GitHub run `32828410493` binds exact evidence commit `103a330f034a234c52d2d7eb287fd154c4e4b902` across Ubuntu and Windows; promotion beyond candidate remains closed.

## Evidence Court

| Gate | Result | Evidence |
|---|---|---|
| EXPRESS | CANDIDATE | RCL Autodiff Genome represents graph, parameters, edges, stops and accumulation |
| COMPILE | PASS_LOCAL | self-host and bootstrap RBC are byte-identical |
| LOWER | CANDIDATE | generic JSON Tensor graph to Rust organ; typed/self-host graph lowering remains open |
| EXECUTE | PASS_LOCAL | native VM Genome plus release Rust Autodiff/Batch-SGD execution |
| CORRECT | PASS_LOCAL | analytic drift `0`; finite-difference drift `3.7655e-10`; MLP oracle drift `1.7764e-15` |
| ROBUST | PASS_LOCAL | fail-closed identity/loss/rule/resource controls; exact checkpoint resume |
| PERFORMANCE | CANDIDATE | bounded local timings recorded; peak RSS and general/portable ratios unmeasured |
| AI_GENERATE | NOT_APPLICABLE_TO_ENGINE_E2_ADMISSION | existing K233 receipt is not reused to promote this engine stage |
| EVIDENCE | CANDIDATE_HOSTED_BOUND | rooted local receipt plus successful exact-SHA Ubuntu and Windows replay |

The nine K400 gates are not reassigned. K233 remains the previously admitted bounded AI-N2 cell; K08-G adds infrastructure evidence but no new cell or gate PASS.

## Negative evidence retained

The first 32 versus 16+16 checkpoint probe differed by one ULP. Validation consumed exact f64 Storage bits, but the mutable SGD buffer still began from the decimal JSON value. The fix materializes exact bits into mutable parameter storage before the first update. No tolerance changed and the failed probe is recorded as `STRESS_AI_EXACT_GRADIENT_CHECKPOINT`.

## License and diff audit

- Cargo dependencies and lockfile are unchanged.
- npm dependencies and lockfile are unchanged.
- New source remains under the repository Apache-2.0 license.
- No vendored kernel, external model weight, dataset or generated binary is committed.
- `unsafe` count added: `0`.

## Admission decision

Admit as `ENGINE_E2_AUTODIFF_CANDIDATE_GITHUB_REPLAY_BOUND` only. The rooted hosted receipt closes ENGINE-E2 replay admission but grants no canonical-core promotion, K400 change or ENGINE-E3 capability. ENGINE-E3 may now begin on a separate candidate branch.
