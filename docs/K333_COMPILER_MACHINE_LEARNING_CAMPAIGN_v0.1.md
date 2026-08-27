# K333 Compiler Machine-Learning Campaign v0.1

**Status:** `PASS_RECEIPT_REPLAY_GITHUB_LINUX_WINDOWS_NATIVE_COMPILER_ML_AUTHORITY_BOUND`; K333 is admitted only for the frozen bounded integer-perceptron advisory profile.

## Reality Audit

- Current integrated base: `origin/main@9e68bb2bf97f39149a4c94750209a76a1b10d00a` (the contract was originally frozen on `4c7b3f9c1c90da710903487df8d1e766a8b0afc1`; focused and Windows replay remained exact after integration).
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

| Gate | Admitted result |
|---|---|
| EXPRESS | PASS |
| COMPILE | PASS |
| LOWER | PASS |
| EXECUTE | PASS |
| CORRECT | PASS |
| ROBUST | PASS |
| PERFORMANCE | PASS |
| AI_GENERATE | PASS |
| EVIDENCE | PASS |

No gate was promoted from local execution alone. Independent AI repair, exact receipt replay, GitHub-hosted Linux/Windows authority and conditional K400 integration were evaluated as separate mandatory gates.

The frozen AI contract then ran three new ephemeral read-only sessions against separately mutated candidates. All three restored exact canonical bytes and passed native replay:

- label repair: `01a03f24-feda-7fd1-ac12-0960b3e91989`
- perceptron update repair: `01a03f26-d151-75a0-901d-1f2265e032c8`
- model authority repair: `01a03f28-6991-78e3-a5a6-684a0eb1874c`

The accepted aggregate receipt root is `d16ad0df7481c94c5084acac822e32930d8e39aa855c4d43dc8d79cf0a81c2dc`. An earlier 2/3 acquisition was rejected because the first generator repaired the label but also changed an unrelated training sample; native semantics happened to pass, but exact canonical bytes did not. The evaluator was tightened to single-line edit fragments without exposing the oracle edit, and the complete acquisition was rerun with three fresh sessions. That local candidate is now bound by the checked-in hosted authority receipt below.

The checked-in receipt verifier independently reconstructs every mutation, applies only the saved edit in a fresh temporary file, reruns native compilation/execution, validates all rooted runtime and generator receipts, and requires three unique session identities. It also tests rooted runtime tampering and exact GitHub focused/Windows step identities. GitHub run `33008611515` passed focused job `98308743737` and Windows job `98308743547` on exact source commit `6983b7d66813790b0727e4b66aafc8a8a27c4b01`; authority root `72e8b699d53f5685b542de32dfdee2a3d41eea4b3c1bbed0395b9fc6f77d663d` admits K333 only.

The K400 builder records K333 runtime, AI and hosted-authority receipts and now creates `compiler-runtime::machine-learning`. The report remains `INCOMPLETE`, maturity `U3`, with `17 PASS / 383 UNTESTED`; report root `1320f279933361b6a8ae8109d310c8590c4e5aaa911c28fa35372fda0831e5a1`.

## Federation, license and regression boundary

Existing K08 Tensor/Autodiff/AdamW/GQA/RoPE candidates were audited as donors, but the frozen K333 profile needs none of their auxiliary Rust execution organs. It reuses general RCL sequences, recursion, arithmetic and native compiler/runtime semantics. No dependency or third-party code was added, so there is no new license surface. The profile grants no floating-point ML, Transformer, accelerator, arbitrary compiler learning, compiler decision authority, K233 inheritance, unrelated K400 cell or K400 completion claim.
