# K08-S BF16 Autodiff + AdamW Evidence v0.2

## Ruling

`BF16_AUTODIFF_ADAMW_REFERENCE_CANDIDATE_GITHUB_REPLAY_BOUND`

This is a bounded, generic Tensor SSA candidate. RCL owns the precision, cast, reverse-gradient, optimizer-state, parameter-order and checkpoint semantics. Rust is the CPU reference execution organ. The candidate is not a GPU, multi-block BF16 or RCL-10M admission.

## Reality Audit and branch ruling

- Canonical repository: `xingxuling/RCL`.
- Audited latest main: `origin/main@30c162c6cd13b2c9310202f2a604da23e5b4c552`.
- Historical K08-S branch: `origin/codex/rcl-1b-bf16-autodiff-v01@1c9cb93bb687eb47fb39ea7dd392d8cd5d607b30`.
- Historical delta: one 606-line matmul/MSE reference binary, no K08-S contract or independent test/evidence suite.
- Integration ruling: create a clean campaign branch from latest main and cherry-pick the one historical source commit. Direct continuation of the old branch was rejected because it lagged current main.

## Semantic policy

```text
FP32 master weights
  -> BF16 round-to-nearest-ties-to-even projection
  -> BF16 parameters and activations
  -> FP32 matmul/reduction/normalization/softmax accumulation
  -> RCL generic Reverse Autodiff
  -> FP32 gradients under straight-through-fp32 cast backward
  -> FP32 AdamW moments and master update
  -> exact FP32 bits in canonical parameter order
```

The JSON `f64` array is only a transport container for the existing Tensor ABI. BF16 and FP32 authority is carried by explicit descriptor, precision-policy and exact-bit fields; decimal JSON is not checkpoint authority.

## Local evidence

| Evidence | Result |
|---|---:|
| RCL genome self-host compile/native root | PASS |
| K08-S Node evidence suite | `9/9 PASS` |
| Rust Tensor unit suite | `7/7 PASS` |
| BF16 RNE bit oracle | PASS |
| BF16 forward scalar-loss differential | PASS |
| FP32 gradient finite-difference under STE surrogate | PASS, max absolute drift `< 0.2` |
| FP32 master versus BF16 compute distinction | PASS |
| One-step AdamW bit oracle | PASS |
| Loss decrease | PASS |
| Direct/replay determinism | PASS |
| Exact checkpoint resume and root parity | PASS |
| Malformed/non-finite/state-order negatives | PASS |
| Unsupported accelerator fallback | PASS, fail closed |
| Hosted Ubuntu + Windows replay | PASS, run `32987036258`, head `73336cb7b76dbecd95aabe7f840374067c22c15a`, evidence root `fc3235622a6d0da8259d2b73fad5eb14dadc58c6fbb54cb9716335b58480db2e` |
| Real GPU execution | NOT AVAILABLE / CLOSED |

Reproduction:

```text
npm run verify:version-contract
npm run test:k08-bf16-autodiff-adamw
cargo test --release --locked --manifest-path native/tensor-engine/Cargo.toml
```

The first local evidence attempt reported `7/9` because the test expected gradient receipts to carry `tensorId` while the new receipt schema did not. That was a receipt-binding defect, not a numerical failure; it was fixed and the unchanged suite reran at `9/9`. No tolerance was relaxed and no failed numerical test was removed.

## K400 / Integration Court gates

| Gate | Ruling | Boundary |
|---|---|---|
| EXPRESS | CANDIDATE | RCL genome and generic Tensor/Autodiff contract express the policy |
| COMPILE | PASS_LOCAL | genome byte parity and native semantic root |
| LOWER | CANDIDATE | generic graph precision lowering to Rust reference organ; hosted/typed lowering remains open |
| EXECUTE | PASS_LOCAL | release Rust CPU reference on current Windows host |
| CORRECT | PASS_LOCAL | independent BF16/gradient/AdamW/replay oracles |
| ROBUST | PASS_LOCAL | exact bits, order, shape, nonfinite and backend negatives |
| PERFORMANCE | CANDIDATE | correctness runtime only; no accepted throughput/RSS benchmark |
| AI_GENERATE | NOT_APPLICABLE | no new K400 AI-generation claim |
| EVIDENCE | CANDIDATE_GITHUB_REPLAY_BOUND | rooted source/contract/test evidence plus Ubuntu/Windows hosted replay |

No K400 cell is promoted by this candidate.

## Gap Register

| Gap | Current ruling | Next evidence gate |
|---|---|---|
| `RCL_GAP_GPU_EXECUTION` | BLOCKED / no real accelerator runner accepted | identify a real CUDA/ROCm/Vulkan/Metal device and differential-run it; CPU cannot satisfy GPU |
| `RCL_GAP_K08_S_HOSTED_REPLAY` | CLOSED_FOR_THIS_CANDIDATE | run `32987036258` passed Ubuntu job `98235663711` and Windows job `98235663539` on exact head `73336cb7b76dbecd95aabe7f840374067c22c15a` |
| `RCL_GAP_BF16_MULTI_BLOCK_INTEGRATION` | OPEN | integrate K08-N/O/P/R graph with this precision policy after K08-S hosted admission |
| `RCL_GAP_RCL10M_TOKENIZER_DATASET` | OPEN | freeze real Byte/BPE artifact and provenance-bearing dataset before any RCL-10M claim |

## Claims not granted

`GPU`, `CUDA`, `ROCm`, `VULKAN_GPU`, `MULTI_BLOCK_BF16_TRAINING`, `RCL_10M`, `RCL_1B`, `DISTRIBUTED_TRAINING`, `PRODUCTION_TOKENIZER`, `PRODUCTION_DATASET`, `K400_PROMOTION`.
