# K08-D General MLP Tensor Lowering Integration Court

**Court state:** `ADMIT_ENGINE_E1_GENERAL_MLP_TENSOR_LOWERING_CANDIDATE_GITHUB_REPLAY_BOUND`

**Canonical owner:** unchanged RCL General MLP model and Tensor operation semantics

**Auxiliary compiler organ:** JS generic Tensor SSA lowerer, candidate-only

**Execution organ:** `native/tensor-engine` Rust CPU backend through `RclVmProviderV1`

## Decision

Admit the bounded General MLP Tensor lowering as GitHub replay-bound candidate evidence. The unchanged XOR and Majority-3 model source lowers to a rooted 29,980-node plan using only `abs/add/div/matmul/mul/sub/sum/transpose`. The Rust backend computes every training value; neither the lowerer, VM nor provider adds a model-special operation. GitHub run `32810795935` replayed the Ubuntu portable suite and Windows Provider/evidence path for exact implementation commit `8b53c60321345fdcc9449c1a5b7b522a3e7939a9`.

The candidate preserves oracle/scalar parity, deterministic roots and exact checkpoint resume across serialization. Its local same-machine median improves from scalar Native RCL `2537.360 ms` to Tensor Plan `443.592 ms`, a `5.720x` speedup. The Native/JS ratio falls from `118.300x` to `15.863x`, so performance remains an open gate. This court grants no K233 relabel, K400 promotion, native Autodiff, AdamW, Transformer, GPU or distributed claim.

## Multi-civilization gates and engineering effects

| Gate | Concrete effect |
|---|---|
| Founder Twin | Preserved one RCL Model/Tensor semantic owner and required a reusable plan instead of an MLP opcode. |
| 柳清莲 Gate | Kept the local result candidate-only and separated evidence from promotion authority. |
| 洞哥 Grounding | Required the real release Rust backend behind native RBC/VM/Provider execution. |
| Product | Targeted the measured 118.300x user-visible MLP bottleneck first. |
| UX | Kept one reproducible command and one rooted machine-readable receipt. |
| Engineering | Used SSA descriptors, source/contract bindings and explicit resource caps. |
| Code | Rejected XOR, Majority, MLP, train and other model-special operations. |
| Test | Covered two architectures, oracle/scalar differential, determinism, exact resume and negative plans. |
| Security | Fails closed on hashes, missing/redefined values, descriptor drift, exact-bit errors and resource overflow. |
| Release | Binds exact-commit Ubuntu and Windows replay; Node action deprecation annotations were non-failing. |
| Integration Court | Admits a GitHub replay-bound Engine E1 lowering candidate only. |
| Evidence Ledger | Roots semantics, backend, lowerer, plan, outputs, checkpoint and timing boundaries. |

## License and diff audit

The change adds original repository code and no copied donor kernel. The existing locked Rust dependencies remain permissively licensed. No RBC opcode, VM ABI, K233 result, model source or model contract is changed. The JS lowerer is explicitly an auxiliary compiler workaround recorded as `RCL_GAP_AI_009/011`.

## Remaining gates

1. Tensor Plan liveness, buffer reuse and compact encoding, followed by remeasurement.
2. Native process peak RSS evidence.
3. Typed/self-hosted RCL plan lowering.
4. Scientific-number semantic-state-root closure.
5. Separate general Autodiff candidate after the execution-plan bottleneck is bounded.
