# K08-C Tensor / CPU Engine Integration Court

**Court state:** `ADMIT_ENGINE_E1_CANDIDATE_GITHUB_REPLAY_BOUND`

**Canonical owner:** RCL typed Tensor and operation semantics

**Execution organ:** `native/tensor-engine` Rust CPU Dense backend

## Decision

Admit the bounded f64 CPU Tensor engine as candidate evidence. GitHub run `32804405376` independently replayed the portable suite on Ubuntu and the real native Provider/performance path on Windows for implementation commit `e5c3124bb759e5d5c2ec8bbf3e668aabc6a0b080`. Do not merge its evidence into K233 authority. K08-D later lowers and remeasures the General MLP under a separate candidate court; it does not retroactively expand this historical receipt.

The provider boundary wins over a new VM opcode in this stage: the existing general `CALL_PROVIDER` ABI preserves portability and self-hosted RBC execution while cache blocking, auto-vectorization, buffer ownership and future threading/BLAS remain backend concerns. A future generic Tensor opcode is not prohibited, but it needs evidence that provider dispatch or IR serialization is the dominant bottleneck. Model-specific opcodes remain rejected.

## Multi-civilization gates and engineering effects

| Gate | Concrete effect |
|---|---|
| Founder Twin | Required one Tensor/Storage/operation stack reusable by MLP, CNN, attention and scientific matrices. |
| 柳清莲 Gate | Kept all results candidate-only; local performance evidence cannot self-promote K400. |
| 洞哥 Grounding | Required a real release-built Rust binary called by native VM through `RclVmProviderV1`. |
| Product | Prioritized MatMul plus the minimum Transformer-support kernel family. |
| UX | Added stable test/evidence commands and machine-readable request/response formats. |
| Engineering | Separated typed Tensor identity from CPU Dense Storage and preserved one canonical semantic owner. |
| Code | Used generic operations; no XOR, MLP, Transformer or GPT special opcode exists. |
| Test | Added positive, negative, boundary, deterministic, differential and performance coverage. |
| Security | Enforced request schema, dtype/device/layout/storage checks and rank/input/element caps. |
| Release | Locked Cargo dependencies; Windows provider execution is verified locally, cross-platform provider hosting remains open. |
| Integration Court | Admitted `ENGINE_E1_CANDIDATE_LOCAL_WINDOWS`, not VERIFIED or K400 PASS. |
| Evidence Ledger | Bound compiler parity, results, timings, storage identity and explicit gaps into one report root. |

## License and diff audit

The organ is original repository code. Cargo is locked. Direct dependencies are `serde`, `serde_json`, `sha2` and `hex`; their crate manifests declare permissive MIT and/or Apache-2.0 licensing. No BLAS or copied donor kernel was introduced. The implementation adds a new isolated backend and examples/tests/docs; it does not alter RBC opcodes, the VM ABI, K233 evidence or existing model parameters.

## Remaining gates

1. Cross-platform provider host or equivalent ABI integration.
2. Peak RSS/buffer-plan evidence.
3. Typed self-host compiler lowering.
4. Scientific-notation semantic-root canonicalization closure.

## Local regression

The post-change repository suite completed with `849 tests / 848 pass / 0 fail / 1 skip` in `622,404.3434 ms`. The skip is the pre-existing Windows DLL external-link check when Zig is unavailable; the checked native distribution remained source/hash-manifest verified.
