# K08-S BF16 Multi-Block AdamW Evidence v0.1

## Ruling

`BF16_MULTIBLOCK_ADAMW_REFERENCE_CANDIDATE_GITHUB_REPLAY_BOUND`

This candidate composes two generic Tensor SSA blocks under the K08-S BF16 RNE / FP32 accumulation, Reverse Autodiff and AdamW organ. It establishes a bounded two-block BF16 training profile, not the full K08-R GQA+RoPE multi-block profile and not scale evidence.

## Reality and composition boundary

- Base: `origin/main@609fbc57baf7aa7b60eeb8974ba5843dfaec4e10`, after the K08-S hosted candidate and GPU reality audit merges.
- RCL owns block order, parameter identity, BF16 precision policy, FP32 gradient/master/state and exact resume authority.
- The Rust organ remains `rcl-tensor-bf16-autodiff-adamw-cpu-reference-v0.2`.
- The graph is `input -> tokenEmbedding -> block.0 -> block.1 -> lmHead -> next-token loss`.
- Four canonical trainable identities update: shared token embedding, block 0 weight, block 1 weight and shared LM head.

## Local evidence

| Evidence | Result |
|---|---:|
| RCL genome byte parity and native semantic root | PASS |
| Independent two-block BF16 initial loss differential | PASS |
| Loss decrease | PASS |
| Every block and shared parameter updates | PASS |
| FP32 master versus BF16 compute and exact AdamW state | PASS |
| Deterministic replay | PASS |
| Direct 6 steps equals checkpoint 3 plus resume 3 | exact PASS |
| Canonical optimizer-state order negative | fail-closed PASS |
| Model-special operation negative | PASS |
| Node evidence suite | `6/6 PASS` |
| Hosted Ubuntu + Windows replay | PASS, run `32988994250`, Ubuntu job `98241831755`, Windows job `98241831517`, exact head `fa20e5a860bcbc63594f22a6bdfe4c0bd9c21dc5` |

The first test attempt was `5/6`: the test asserted a non-existent genome field `evaluation.block_count_valid` while the RCL genome declares `evaluation.two_block_valid`. The assertion was corrected to the declared field and the unchanged six-test suite reran at `6/6`; no numerical tolerance or claim boundary changed.

## K400 / Integration Court gates

| Gate | Ruling | Boundary |
|---|---|---|
| EXPRESS | CANDIDATE | RCL genome and generic two-block Tensor graph express the composition |
| COMPILE | PASS_LOCAL | genome byte parity and native root |
| LOWER | CANDIDATE | BF16 generic lowering is CPU-reference only |
| EXECUTE | PASS_LOCAL | current Windows CPU reference organ |
| CORRECT | PASS_LOCAL | independent forward/loss, exact replay and state checks |
| ROBUST | PASS_LOCAL | canonical order and model-special negatives fail closed |
| PERFORMANCE | CANDIDATE | no accepted throughput/RSS benchmark |
| AI_GENERATE | NOT_APPLICABLE | no new AI-generation claim |
| EVIDENCE | CANDIDATE_GITHUB_REPLAY_BOUND | Ubuntu/Windows hosted replay passed |

## Gap register

| Gap | Ruling | Next gate |
|---|---|---|
| `RCL_GAP_K08_S_MB_HOSTED_REPLAY` | CLOSED_FOR_THIS_CANDIDATE | run `32988994250` passed Ubuntu and Windows on exact head `fa20e5a860bcbc63594f22a6bdfe4c0bd9c21dc5` |
| `RCL_GAP_GPU_EXECUTION` | BLOCKED | implement and differentially verify a real AMD OpenCL/Vulkan organ |
| `RCL_GAP_RCL10M_TOKENIZER_DATASET` | OPEN | freeze provenance-bearing tokenizer and dataset before scale |

Claims not granted: `BF16_GQA_ROPE_MULTI_BLOCK`, `GPU`, `OPENCL_BF16`, `VULKAN_GPU`, `RCL_10M`, `RCL_1B`, `DISTRIBUTED_TRAINING`, `PRODUCTION_DATASET`, `K400_PROMOTION`.
