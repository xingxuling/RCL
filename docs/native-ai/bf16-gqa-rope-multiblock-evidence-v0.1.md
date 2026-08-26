# K08-R GQA + RoPE BF16 Multi-Block Evidence v0.1

## Ruling

`BF16_GQA_ROPE_MULTIBLOCK_REFERENCE_CANDIDATE_LOCAL_ONLY`

This candidate integrates the existing K08-N RoPE, K08-O GQA and K08-R two-block graph with the K08-S BF16 RNE / FP32 accumulation / Reverse Autodiff / exact FP32 AdamW organ. It is a bounded CPU reference candidate; no GPU or scale claim follows from it.

## Composition

- Base: `origin/main@a095872beca5d61a3ffde99f31e7163dc54a4dbb`.
- Two decoder blocks, two query heads, one shared KV head and head dimension two.
- Fourteen canonical parameter groups: token embedding, six parameters in each block, and LM head.
- Every operation remains generic Tensor SSA: matmul, transpose, add, mul, div, mean, sqrt, softmax, log and sigmoid activation.
- RCL owns block order, GQA/RoPE semantics, precision, parameter identity, optimizer state order and exact checkpoint authority.

## Local evidence

| Evidence | Result |
|---|---:|
| RCL genome byte parity and native semantic root | PASS |
| Two-block GQA+RoPE graph through BF16 Autodiff AdamW | PASS |
| Loss decreases | PASS |
| All fourteen parameter groups update | PASS |
| FP32 masters and exact AdamW state | PASS |
| Deterministic replay | PASS |
| Direct 6 steps equals checkpoint 3 plus resume 3 | exact PASS |
| Canonical state order and model-special operation negatives | fail-closed PASS |
| Local Node evidence suite | `6/6 PASS` |
| Hosted Ubuntu + Windows replay | NOT YET RUN |

The first local attempt was `2/6`: the hand-built `targetOneHot` fixture had 13 values for a 3×4 tensor, and the RCL shape guard rejected it. The fixture was corrected to 12 values and the unchanged suite reran at `6/6`; no numerical tolerance or claim boundary changed.

## K400 / Integration Court gates

| Gate | Ruling | Boundary |
|---|---|---|
| EXPRESS | CANDIDATE | RCL genome and generic GQA/RoPE/block composition express the profile |
| COMPILE | PASS_LOCAL | genome byte parity and native root |
| LOWER | CANDIDATE | CPU BF16 lowering only |
| EXECUTE | PASS_LOCAL | current Windows CPU reference organ |
| CORRECT | PASS_LOCAL | loss, parameter, exact state and replay checks |
| ROBUST | PASS_LOCAL | shape, order and special-operation negatives |
| PERFORMANCE | CANDIDATE | no accepted throughput/RSS benchmark |
| AI_GENERATE | NOT_APPLICABLE | no new AI-generation claim |
| EVIDENCE | CANDIDATE_LOCAL | hosted replay pending |

## Gap register

| Gap | Ruling | Next gate |
|---|---|---|
| `RCL_GAP_K08_R_BF16_HOSTED_REPLAY` | OPEN | Ubuntu + Windows replay bound to exact source head |
| `RCL_GAP_GPU_EXECUTION` | BLOCKED | implement and differentially verify a real AMD OpenCL/Vulkan organ |
| `RCL_GAP_RCL10M_TOKENIZER_DATASET` | OPEN | freeze provenance-bearing tokenizer and dataset before scale |

Claims not granted: `GPU`, `OPENCL_BF16`, `VULKAN_GPU`, `RCL_10M`, `RCL_1B`, `DISTRIBUTED_TRAINING`, `PRODUCTION_DATASET`, `K400_PROMOTION`.
