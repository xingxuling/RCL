# K08-O GQA Integration Court v0.1

## Target ruling

Admit parametric multi-head / grouped-query attention composition with per-head RoPE on the existing generic Tensor and Reverse Autodiff substrate.

## Founder Twin

PASS. The change advances the frozen RCL-1B campaign directly: the target 16Q/4KV geometry is representable without changing canonical Tensor ownership or adding model-special opcodes.

## 柳清莲 Gate

PASS. Claim wording remains bounded. The evidence grants multi-head/GQA composition only; it does not claim multi-block language-model scale, GPU performance, or RCL-1B completion.

## 洞哥 Grounding

PASS. Hosted execution exists on Ubuntu and Windows. Forward values are compared with an independent oracle and gradients with finite difference.

## 产品文明

N/A. No user-facing product surface changes.

## UX / 设计文明

N/A. No user-facing interaction or visual change.

## 工程文明

PASS. The implementation reuses K08-N RoPE and the existing Tensor/Autodiff ABI. The 2Q/1KV frozen profile and RCL-1B 16Q/4KV geometry are explicitly validated.

## 代码文明

PASS. Head split/merge uses generic selector/embedder matrices and generic `matmul/add`; attention uses existing `matmul/mul/add/softmax/transpose`. No `gqa-special` or `multihead-special` operation is added.

## 测试文明

PASS. Hosted run `32847865516` passes 8/8 tests on both Ubuntu (`97801676252`) and Windows (`97801676519`). Positive, boundary, differential, gradient, and negative special-opcode controls are present.

## 安全文明

PASS for the bounded semantic scope. Invalid query/KV head ratios, hidden widths, odd head dimensions, and model-special operation injection fail closed.

## 发布文明

PASS for merge as a hosted candidate. Do not advertise RCL-10M/1B or production performance from this milestone.

## Integration Court verdict

`ADMIT_GQA_GENOME_CANDIDATE_GITHUB_REPLAY_BOUND`

The canonical meaning remains RCL-owned. Selector/embedder matrices are a correctness-first lowering, not a claim that this is the final high-performance head representation. Packed-head/fused kernels remain backend candidates and must preserve differential parity.

## Rollback

The change is additive: GQA semantic genome, contract, tests, workflow, evidence, and documentation. Reverting the K08-O commits leaves K08-N RoPE and the previous one-head decoder path intact.
