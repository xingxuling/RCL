# GPU-Native BF16 Backward + AdamW Evidence v0.1

## Ruling

`PASS_LOCAL_GPU_NATIVE_REVERSE_ADAMW_CANDIDATE_GITHUB_REPLAY_BOUND`

This candidate binds a generic RCL BF16 Tensor SSA graph to three bounded AMD
OpenCL lowerings: left and right matmul gradients, and elementwise FP32 AdamW.
RCL owns the graph, reverse rules, BF16 RNE, FP32 accumulation, master weights,
optimizer state, exact checkpoint identity and all admission decisions. The
Python provider owns lowering only; unsupported devices and provider failures
remain fail-closed.

The placement policy remains explicit:

- `matmul` nodes use `placement: "gpu"` and execute through the AMD OpenCL provider;
- all non-matmul nodes use `placement: "cpu-reference"`;
- GPU reverse executes both generic matmul-gradient primitives;
- GPU AdamW executes the elementwise update over FP32 master/state buffers;
- missing placement, missing/unavailable provider and backend mismatch reject the request.

This is a bounded GPU-native reverse/optimizer candidate. It is not a full
`GPU_TRAINING` claim: full-graph GPU execution, multi-block GQA/RoPE GPU
training, scale, portability, RCL-10M and K400 promotion remain closed.

## Local evidence

| Evidence | Result |
|---|---:|
| RCL-owned genome and contract compile | PASS |
| Real AMD OpenCL left matmul-gradient primitive | PASS, current `gfx1152` |
| Real AMD OpenCL right matmul-gradient primitive | PASS, current `gfx1152` |
| Real AMD OpenCL FP32 AdamW primitive | PASS, current `gfx1152` |
| Generic RCL graph reaches GPU forward and reverse primitives | PASS |
| GPU AdamW executes over FP32 master and state buffers | PASS |
| CPU reference loss/parameters/optimizer state/checkpoint differential | exact PASS |
| Direct replay and checkpoint resume | exact PASS |
| Placement/provider/backend negative boundaries | fail-closed PASS |
| Local candidate suite | `3/3 PASS` |
| Existing GPU hybrid and CPU multi-block regressions | `15/15 PASS` |
| Rust Tensor unit tests | `7/7 PASS` |

The integrated telemetry for the minimal generic graph records one GPU forward
matmul, two GPU reverse matmul-gradient executions, four GPU optimizer elements
over two steps and one execution root per admitted provider invocation. The
provider returns exact FP32 bit strings; the Rust organ validates and imports
them without a CPU fallback.

## K400 / Integration Court gates

| Gate | Ruling | Boundary |
|---|---|---|
| EXPRESS | CANDIDATE | RCL contract expresses generic reverse matmul and AdamW lowering |
| COMPILE | PASS_LOCAL | genome, Rust organ, provider and workflow compile |
| LOWER | PASS_LOCAL_CANDIDATE | three provider primitives lower to AMD OpenCL |
| EXECUTE | PASS_LOCAL | current AMD GPU executed forward, reverse and optimizer kernels |
| CORRECT | PASS_LOCAL | CPU reference and exact checkpoint outputs match bit-for-bit |
| ROBUST | PASS_LOCAL | placement, provider and backend negatives fail closed |
| PERFORMANCE | NOT_EVALUATED | process-per-primitive dispatch is not throughput evidence |
| AI_GENERATE | NOT_APPLICABLE | no learned generation claim |
| EVIDENCE | CANDIDATE | local receipt and Ubuntu/Windows hosted replay are bound |

No K400 cell is promoted by this candidate. The evidence is a bounded stress
case for RCL GPU lowering and does not transfer authority to the auxiliary
provider.

## Hosted boundary

PR #93 dedicated workflow run `33005295847` passed on Ubuntu job
`98297368527` and Windows job `98297368737`. Hosted runners prove portable
compilation/replay and explicit unavailable-device behavior; they do not
inherit the current host's AMD device receipt or promote this candidate to
`GPU_TRAINING`.

## Open gaps

| Gap | Ruling | Next gate |
|---|---|---|
| `RCL_GAP_GPU_AUTODIFF_ADAMW_INTEGRATION` | PARTIALLY REDUCED | integrate the GPU-native primitives into multi-block GQA/RoPE and run larger real-GPU evidence |
| `RCL_GAP_RCL10M_TOKENIZER_DATASET` | OPEN / BLOCKED_USER_CORPUS | user-owned multilingual/code bytes, license/privacy/poison review, tokenizer freeze and deterministic shards |

Claims granted only:

- `OPENCL_AMD_BF16_MATMUL_GRADIENT_LOWERING`
- `OPENCL_AMD_FP32_ADAMW_LOWERING`
- `OPENCL_GPU_NATIVE_REVERSE_ADAMW_CANDIDATE`

Claims not granted: `GPU_TRAINING`, `OPENCL_BF16_FULL_GRAPH`, generic GPU
portability, GPU-native GQA/RoPE full training, RCL-10M, RCL-1B, distributed
training and K400 promotion.

Authority files:

- `examples/native-ai/gpu-native-backward-adamw-genome.rcl`
- `examples/native-ai/gpu-native-backward-adamw-contract.v0.1.json`
- `examples/native-ai/evidence/gpu-native-backward-adamw-v0.1/k08-gpu-native-backward-adamw-local-evidence.json`
- `native/tensor-engine/src/autodiff.rs`
- `native/tensor-engine/src/bin/rcl-bf16-autodiff-adamw.rs`
- `native/tensor-engine/amd_opencl_bf16_provider.py`

Reproduction: `npm run test:k08-gpu-native-backward-adamw`.
