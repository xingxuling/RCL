# K08-P Multi-Block LM Integration Court v0.1

## Target ruling

Admit bounded parametric ordered multi-block decoder composition and cross-block Reverse Autodiff as the next RCL-1B model-side scale gate.

## Founder Twin

PASS. This advances the frozen RCL-1B target directly. The same model topology function accepts 1, 2 and structurally 24 blocks; the 24-block target is not claimed as executed.

## 柳清莲 Gate

PASS. Claim boundaries are explicit. Multi-block forward/loss and cross-block gradients are admitted; multi-block AdamW replay, RCL-10M, GPU and RCL-1B remain closed.

## 洞哥 Grounding

PASS. Ubuntu and Windows execute the same two-block graph and agree with an independent forward oracle plus finite-difference gradient probes.

## 产品文明

N/A. No user-facing product surface changes.

## UX / 设计文明

N/A. No interaction or visual changes.

## 工程文明

PASS. Blocks are emitted from one parametric builder and own block-index-scoped parameters. K08-O GQA and K08-N RoPE are composed rather than redefined.

## 代码文明

PASS. The topology lowers entirely to generic Tensor primitives and existing Reverse Autodiff. No multi-block/decoder/GPT-special primitive is introduced.

## 测试文明

PASS. Hosted run `32848996210` passes 9/9 on Ubuntu `97805250272` and Windows `97805250421`. Tests cover source self-host parity, one/two-block parametric construction, independent oracle, order observability, all-parameter gradients, finite difference across both blocks, generic LM loss, invalid boundaries, duplicate parameter identity and model-special injection.

## 安全文明

PASS for the bounded semantic scope. Block-count limits and parameter identity are fail-closed. Tensor execution rejects unknown model-special operations.

## 发布文明

PASS for hosted-candidate merge. Public claims must not imply that 24 blocks, RCL-10M, BF16/GPU or production training have executed.

## Integration Court verdict

`ADMIT_MULTI_BLOCK_LM_CANDIDATE_GITHUB_REPLAY_BOUND`

The canonical meaning is ordered model topology under RCL ownership. Future graph compaction, block scheduling, activation checkpointing and fused kernels are execution/performance organs and must preserve the admitted model semantics.

## Rollback

Additive milestone. Reverting K08-P leaves the K08-O GQA, K08-N RoPE and earlier one-block Tiny LM paths intact.
