# K09 AMD OpenCL Persistent Dispatch Evidence v0.1

## Ruling

`PASS_LOCAL_AND_HOSTED_OPENCL_PERSISTENT_DISPATCH_CANDIDATE`

The K09 candidate reduces a concrete execution-organ gap in the RCL-native
GPU campaign. One RCL BF16 training request now opens one provider process and
one AMD OpenCL context/program session. Ordered matmul, reverse matmul-gradient
and AdamW requests travel over newline-delimited JSON and continue to use the
same RCL-owned semantics and exact bit contracts.

The provider remains auxiliary. It owns OpenCL lowering and transport only;
RCL owns Tensor SSA, placement admission, BF16 RNE, FP32 accumulation and
gradient rules, FP32 master weights, AdamW state, parameter order, checkpoint
identity and fail-closed decisions. Kernel, input-buffer and output-buffer
objects remain isolated per request. No CPU fallback is introduced.

This is a candidate for persistent provider transport, not a claim for batched
kernels, device-buffer residency, GPU training promotion, throughput,
portability, RCL-10M or K400.

## Local execution

The current Windows host executed the real AMD OpenCL path:

| Evidence | Result |
|---|---:|
| RCL K09 genome and contract compile | PASS |
| Two ordered requests through one `--session` provider invocation | PASS |
| Session smoke output bits / execution root | `4000` / exact equal |
| Two-block GQA+RoPE GPU-native backward + AdamW integration | `3/3 PASS` |
| One-step persistent provider request count | `338` |
| CPU loss/parameters/optimizer/checkpoint differential | exact PASS |
| Direct replay and checkpoint resume | exact PASS |
| Placement/provider/backend negative controls | fail-closed PASS |
| K08-S BF16 Autodiff + AdamW regression | `9/9 PASS` |
| K08-S multi-block regression | `6/6 PASS` |
| K08-R BF16 GQA+RoPE regression | `6/6 PASS` |
| GPU-native backward/AdamW regression | `3/3 PASS` |
| GPU GQA+RoPE forward regression | `3/3 PASS` |
| GPU multiblock hybrid regression | `3/3 PASS` |
| GPU ordered hybrid regression | `3/3 PASS` |
| Rust Tensor unit tests | `7/7 PASS` |

Device receipt:

```text
platform: AMD Accelerated Parallel Processing
vendor: Advanced Micro Devices, Inc.
device: gfx1152
OpenCL: 2.0 AMD-APP (3661.0)
driver: 3661.0 (PAL,LC)
extensions: cl_khr_fp16, cl_khr_fp64, cl_khr_subgroups,
             cl_amd_device_attribute_query
```

The one-step integration test took `1394.0469 ms`; the replay/resume/negative
integration test took `4805.5328 ms`. These are bounded correctness-run wall
times, not throughput measurements. The earlier process-per-primitive receipt
recorded `234474.7675 ms` for its one-step differential, but K09 does not claim
a benchmark because the timing boundary is a test-process observation.

## Hosted boundary

Hosted replay passed for exact evidence head
`fb9afdbf9af318d466a2e2ce8fed03847acfa317`:

- K09 dedicated workflow `33095344582`, Ubuntu job `98598676425` — PASS;
- Universal Stress `33095344489`, focused job `98598676280`, Windows job
  `98598675940` — PASS;
- Authority `33095344565`, job `98598677005` — PASS;
- Canonical Verification `33095344564`, verify job `98598676193` — PASS.

Hosted runners prove compilation, portable session protocol handling and
fail-closed unavailable-device behavior; they do not inherit the current
Windows AMD device receipt. The hosted workflow is:

`/.github/workflows/k09-opencl-persistent-dispatch.yml`

## K400 / Integration Court gates

| Gate | Ruling | Boundary |
|---|---|---|
| EXPRESS | CANDIDATE | RCL expresses the transport and execution contract |
| COMPILE | PASS_LOCAL | Rust, Python, genome, contract and workflow compile |
| LOWER | PASS_LOCAL_CANDIDATE | existing OpenCL primitives lower through one reusable session |
| EXECUTE | PASS_LOCAL | real AMD OpenCL session executed ordered requests |
| CORRECT | PASS_LOCAL | K08-R GPU-native path remains exact against CPU reference |
| ROBUST | PASS_LOCAL | provider, placement and backend negatives fail closed |
| PERFORMANCE | NOT_EVALUATED | no throughput or device-residency claim |
| AI_GENERATE | NOT_APPLICABLE | no learned generation claim |
| EVIDENCE | CANDIDATE | local receipt and hosted replay bound |

No K400 cell is promoted.

## Gap register and next gate

| Gap | Ruling | Next gate |
|---|---|---|
| `RCL_GAP_GPU_PROVIDER_DISPATCH_OVERHEAD` | PARTIALLY REDUCED | hosted replay, larger real-GPU profile, then bounded batched/persistent device-buffer investigation |
| `RCL_GAP_RCL10M_TOKENIZER_DATASET` | OPEN / BLOCKED_USER_CORPUS | user-owned multilingual/code corpus bytes, review, tokenizer freeze and deterministic shards |

Claims granted only:

- `OPENCL_AMD_PERSISTENT_PROVIDER_TRANSPORT_CANDIDATE`

Claims not granted: `OPENCL_BF16_BATCHED_KERNELS`,
`OPENCL_DEVICE_BUFFER_RESIDENCY`, `OPENCL_TRAINING_THROUGHPUT`,
`OPENCL_PORTABILITY`, `GPU_TRAINING_PROMOTION`, `RCL-10M`, `RCL-1B`,
distributed training and K400 promotion.

Authority files:

- `examples/native-ai/gpu-opencl-persistent-dispatch-genome.rcl`
- `examples/native-ai/gpu-opencl-persistent-dispatch-contract.v0.1.json`
- `examples/native-ai/evidence/gpu-opencl-persistent-dispatch-v0.1/k09-opencl-persistent-dispatch-local-evidence.json`
- `native/tensor-engine/amd_opencl_bf16_provider.py`
- `native/tensor-engine/src/autodiff.rs`
- `native/tensor-engine/src/bin/rcl-bf16-autodiff-adamw.rs`

Reproduction:

- `npm run test:k09-opencl-persistent-dispatch`
- `npm run test:k08-gpu-gqa-rope-native-backward-adamw`
