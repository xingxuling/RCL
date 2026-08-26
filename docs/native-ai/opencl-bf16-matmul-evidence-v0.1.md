# AMD OpenCL BF16 Matmul Evidence v0.1

## Ruling

`PASS_LOCAL_AND_HOSTED_GPU_REFERENCE_CANDIDATE`

This candidate is the smallest real accelerator lowerer after the GPU reality audit. RCL remains the canonical owner of BF16 bit encoding, round-to-nearest-ties-to-even conversion, FP32 accumulation, shape validation and fail-closed policy. The Python `ctypes` provider only loads `OpenCL.dll`, selects an AMD GPU, launches a generic matmul kernel and returns an execution receipt.

This is real local AMD OpenCL execution evidence. It is not GPU Autodiff, AdamW, Transformer training or scale evidence.

## Local evidence

| Evidence | Result |
|---|---:|
| RCL-owned genome and contract compile | PASS |
| Real AMD OpenCL device selected | PASS, `gfx1152` |
| OpenCL kernel execution | PASS, `rcl_bf16_matmul` |
| Independent CPU BF16 bit differential | exact PASS |
| Deterministic replay | exact PASS |
| Unsupported backend | fail-closed PASS |
| Non-finite BF16 input | fail-closed PASS |
| Malformed BF16 bits | fail-closed PASS |
| Matrix shape/payload mismatch | fail-closed PASS |
| CPU fallback | forbidden and not observed |
| Local Node evidence suite | `3/3 PASS` |

The fixed local request is a 2×3 by 3×2 multiplication. The independent expected and observed output bits are `4100,bfc0,4188,0000`, representing `8,-1.5,17,0`. The device receipt reports AMD OpenCL 2.0 AMD-APP driver `3661.0 (PAL,LC)` and device `gfx1152`. Execution root: `f30fadc20ee9cc42a2b3ddbf2709da11b44fca04ebc969536a76444d87d45db1`.

## K400 / Integration Court gates

| Gate | Ruling | Boundary |
|---|---|---|
| EXPRESS | CANDIDATE | RCL contract expresses bounded generic BF16 matmul lowering |
| COMPILE | PASS_LOCAL | genome compiles through the RCL compiler; provider syntax passes |
| LOWER | PASS_LOCAL_CANDIDATE | Python ctypes lowers only to the AMD OpenCL provider |
| EXECUTE | PASS_LOCAL | actual current-host AMD GPU execution |
| CORRECT | PASS_LOCAL | independent CPU bit-level differential |
| ROBUST | PASS_LOCAL | malformed, non-finite, shape and backend negatives |
| PERFORMANCE | NOT_EVALUATED | no throughput claim |
| AI_GENERATE | NOT_APPLICABLE | no model generation claim |
| EVIDENCE | CANDIDATE | local device receipt is bound; hosted replay is pending |

## Hosted boundary

The workflow passed the same three tests on Ubuntu and Windows in run `32993386531`, head `a45622d5d3eeee61528d797c38b2f55b1abe78de`. Hosted runners may pass by proving the test or by reporting only the explicit unavailable-backend/device boundary. They do not inherit the local AMD receipt and cannot promote this to a generic GPU claim.

## Gap register

| Gap | Ruling | Next gate |
|---|---|---|
| `RCL_GAP_OPENCL_HOSTED_REPLAY` | CLOSED_FOR_THIS_CANDIDATE | run `32993386531`, Ubuntu job `98256291089` and Windows job `98256291461` passed |
| `RCL_GAP_GPU_AUTODIFF_ADAMW_INTEGRATION` | OPEN | lower one K08-S BF16 matmul through this provider with an independent end-to-end training differential |
| `RCL_GAP_RCL10M_TOKENIZER_DATASET` | OPEN | freeze provenance-bearing tokenizer and dataset before scale |

Claims not granted: `GENERIC_GPU_BACKEND`, `OPENCL_BF16_AUTODIFF`, `OPENCL_BF16_ADAMW`, `GPU_TRAINING`, `BF16_GQA_ROPE_GPU`, `RCL_10M`, `RCL_1B`, distributed training and K400 promotion.

Authority files:

- `examples/native-ai/opencl-bf16-matmul-genome.rcl`
- `examples/native-ai/opencl-bf16-matmul-contract.v0.1.json`
- `examples/native-ai/evidence/opencl-bf16-matmul-v0.1/k08-amd-opencl-local-evidence.json`
- `native/tensor-engine/amd_opencl_bf16_provider.py`

Reproduction: `npm run test:k08-amd-opencl-bf16`.
