# K333 Compiler Machine-Learning Campaign v0.1

**Status:** local runtime candidate; `AI_GENERATE`, hosted Linux/Windows replay and K400 admission remain `UNVERIFIED`.

## Reality Audit

- Base: `origin/main@4c7b3f9c1c90da710903487df8d1e766a8b0afc1`.
- Coordinate: `K333 compiler-runtime::machine-learning`.
- Canonical semantic owner: RCL.
- Execution boundary: native `rclc` using the checked-in self-host compiler artifact, followed by native `rclvm`.
- Profile: bounded integer perceptron that learns a compiler optimization recommendation from IR-node and hotness features.
- Authority: the learned output is advisory; deterministic compiler policy retains commit authority.

K333 is not a relabel of K233. K233 covers a bounded two-Dense-layer General MLP in the AI Runtime row. This candidate instead exercises a distinct compiler-runtime workload: RCL expresses and executes dataset construction, perceptron updates, training, inference, a compiler-oriented recommendation and a fail-closed authority boundary. No provider call, model-special opcode, Python trainer or opaque delegation participates.

The first design probe used floating-point gradient descent and reached native compilation, but strict evidence verification failed with `RCL_NATIVE_STATE_ROOT_MISMATCH`. The candidate did not disable semantic-state-root verification. It records `RCL_GAP_K333_FLOAT_STATE_ROOT_CANONICALIZATION` and freezes an integer perceptron profile whose complete state is exactly portable. A future floating-point K333 profile still requires common JS/native numeric state-root canonicalization.

## Frozen acquisition

The contract was frozen only after the integer probe established bootstrap/self-host byte parity and exact native state:

- source SHA-256: `44933d704a3365bbb2b73a1e0b1bd4cb57cc4ee2f3a302e2b4521e85db39e917`
- RBC SHA-256: `86000933fd75557ecdc48c83c6fe0300652da020ae967247abc1435cdc34078b`
- semantic state root: `eece94a8c1afe9dc74f0b16814fbad5aa234f58e90cfafc2d03e4f406df6a1ca`
- final parameters: `[3, 1, -5]`
- training accuracy: `1`
- held-out compiler-feature score: `9`
- small/cold boundary classification: `0`
- model commit authority: `false`

Formal local acquisition passed 20/20 native rounds with one artifact hash and one semantic state root. An independent JavaScript perceptron oracle matched exact parameters, accuracy, score, classification, recommendation and authority state. Five controls passed: training-label mutation, update-sign mutation, zero epochs, attempted model commit authority and corrupt RBC. Windows-local p95 was `121.4846 ms` compile, `33.6748 ms` execute and `154.8318 ms` combined against frozen `5000/1000/6000 ms` budgets. Runtime report root: `7abcf71ae895f4db73a826d434dc525ca9fd6d6b2a6157384267939153e395fd`.

## Nine-gate boundary

| Gate | Local result |
|---|---|
| EXPRESS | CANDIDATE |
| COMPILE | CANDIDATE |
| LOWER | CANDIDATE |
| EXECUTE | CANDIDATE |
| CORRECT | CANDIDATE |
| ROBUST | CANDIDATE |
| PERFORMANCE | CANDIDATE |
| AI_GENERATE | UNVERIFIED |
| EVIDENCE | CANDIDATE |

No gate is promoted to K400 `PASS` from local execution alone. Independent AI repair, exact receipt replay, GitHub-hosted Linux/Windows authority and conditional K400 integration remain separate mandatory gates.

## Federation, license and regression boundary

Existing K08 Tensor/Autodiff/AdamW/GQA/RoPE candidates were audited as donors, but the frozen K333 profile needs none of their auxiliary Rust execution organs. It reuses general RCL sequences, recursion, arithmetic and native compiler/runtime semantics. No dependency or third-party code was added, so there is no new license surface. The profile grants no floating-point ML, Transformer, accelerator, arbitrary compiler learning, compiler decision authority, K233 inheritance, unrelated K400 cell or K400 completion claim.
