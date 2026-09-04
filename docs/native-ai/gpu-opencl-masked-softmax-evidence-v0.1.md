# K16 AMD OpenCL BF16 additive masked softmax evidence v0.1

## Current ruling

`PASS_LOCAL_AND_HOSTED_AND_POSTMERGE_OPENCL_MASKED_SOFTMAX_CANDIDATE`

RCL owns the generic Tensor masked-softmax meaning: additive mask semantics,
stable row normalization, BF16 storage, FP32 accumulation and BF16 round-to-
nearest-even output. The AMD OpenCL provider is an auxiliary lowerer for one
bounded row kernel. K16 proves a real local AMD execution and exact CPU
differential for a rank-2 `2 x 3` fixture, with fail-closed backend, mask-mode,
non-finite and shape controls. It does not claim full graph integration,
training-step residency, GPU Autodiff/AdamW, GPU training, throughput, VRAM,
portability, RCL-10M/RCL-1B or K400 promotion.

## Local evidence

- The real AMD OpenCL device is `gfx1152` on
  `AMD Accelerated Parallel Processing`, OpenCL `2.0 AMD-APP (3661.0)`.
- The two-row additive-mask fixture returned exact BF16 bits
  `3f80 31c1 3283 323f 3f3b 3e8a`. The decoded values were
  `[1, 5.617039278149605e-9, 1.525040715932846e-8, 1.1117663234472275e-8,
  0.73046875, 0.26953125]`; both rows normalized to one within the test
  tolerance.
- The provider reported `gpuExecuted: true` while the authority field remained
  `gpuClaim: false`. The deterministic execution root was
  `959537aaf0115e819ad927a3d1fc3ec6eff6a9dbba086c964460f5036f4c9e03`, and a
  second execution reproduced both the output bits and root.
- The independent JavaScript BF16/FP32 stable-softmax oracle matched exactly.
  The local K16 protocol suite is `3/3 PASS`.
- Negative controls rejected a CPU backend with
  `RCL_OPENCL_BACKEND_UNAVAILABLE`, boolean masking with
  `RCL_OPENCL_MASK_MODE`, non-finite BF16 input with
  `RCL_OPENCL_BF16_NONFINITE`, and a shortened mask payload with
  `RCL_OPENCL_SHAPE`. Provider fallback is forbidden.
- Python syntax and `git diff --check` passed. K08 AMD OpenCL plus K09–K15
  regression suites passed locally. No dependency, external source or donor
  code was added.

## No Silent RCL Bypass ruling

| Field | Ruling |
|---|---|
| Task | K16 bounded GPU-native additive masked softmax lowerer |
| Missing capability | Lower RCL-owned masked-softmax semantics to an explicit accelerator kernel while retaining CPU differential proof |
| Prior workaround | Non-matmul attention nodes stayed on the RCL CPU reference path |
| Donor | Existing RCL generic softmax/add semantics, K08 mixed-precision policy and K09 AMD OpenCL provider boundary |
| Gap type | Backend / lowering / numerical-evidence gap |
| Generality | Cross-model attention and Tensor workloads |
| Candidate absorption | RCL-owned additive-mask contract and genome with an auxiliary AMD OpenCL row-kernel lowerer, exact BF16 differential and fail-closed validation |
| K400 impact | K233 performance and future scale evidence only; matrix remains `23/400` |

## Evidence boundary

| Gate | Ruling |
|---|---|
| EXPRESS | CANDIDATE |
| COMPILE | PASS_LOCAL |
| LOWER | PASS_LOCAL_CANDIDATE |
| EXECUTE | PASS_LOCAL_REAL_AMD |
| CORRECT | PASS_LOCAL_EXACT_BF16_BITS_AND_CPU_DIFFERENTIAL |
| ROBUST | PASS_LOCAL_FAIL_CLOSED_BACKEND_MASK_MODE_NONFINITE_AND_SHAPE |
| PERFORMANCE | ROW-KERNEL_AND_OUTPUT_TELEMETRY_ONLY_NO_THROUGHPUT_OR_VRAM_CLAIM |
| AI_GENERATE | NOT_APPLICABLE |
| EVIDENCE | CANDIDATE_HOSTED_AND_POSTMERGE_K16_SCOPE |

The candidate grants only
`OPENCL_AMD_BF16_MASKED_SOFTMAX_LOWERING_CANDIDATE` and
`OPENCL_AMD_GPU_NATIVE_ADDITIVE_MASK_CANDIDATE`. It does not grant
`GPU_TRAINING`, GPU-native Autodiff/AdamW, full graph or training-step
residency, parallel execution, throughput, VRAM reduction, portability,
RCL-10M, RCL-1B or K400 completion.

## Hosted and post-merge boundary

PR #125 replayed the exact implementation head on Ubuntu and Windows. K16,
K08 AMD, K09–K15, Authority, Canonical and Universal checks all passed. The
same K16, K09–K15, Authority, Canonical and Universal scope passed after merge
on `main@c13a573e997cf59d8f80c79bb79ca69b238ae56f`; the exact run/job
receipts are retained in the JSON evidence file.

## Authority files

- `examples/native-ai/gpu-opencl-masked-softmax-contract.v0.1.json`
- `examples/native-ai/gpu-opencl-masked-softmax-genome.rcl`
- `native/tensor-engine/amd_opencl_bf16_provider.py`
- `tests/k16-opencl-masked-softmax.test.mjs`
- `examples/native-ai/evidence/gpu-opencl-masked-softmax-v0.1/k16-opencl-masked-softmax-local-evidence.json`

Reproduction: `npm run test:k16-opencl-masked-softmax`.
