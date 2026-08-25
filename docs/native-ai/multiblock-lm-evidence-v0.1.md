# K08-P Multi-Block LM Evidence v0.1

## Ruling

`MULTI_BLOCK_LM_CANDIDATE_GITHUB_REPLAY_BOUND`

This milestone admits bounded ordered multi-block decoder composition with K08-O GQA, K08-N RoPE, generic next-token cross entropy and Reverse Autodiff across block boundaries.

## Hosted evidence

Implementation run `32848996210`, source commit `e702514c833f3c4dea314c7ec565f2233def9e7a`:

- Ubuntu job `97805250272`: 9/9 PASS
- Windows job `97805250421`: 9/9 PASS

Promoted-contract replay `32849222908`, source commit `fd6d214bb11302e395f4320ea3147dfb20a0e082`:

- Ubuntu job `97805961479`: 9/9 PASS
- Windows job `97805961266`: 9/9 PASS

Final bound-contract replay `32849432614`, source commit `dff6294a8c8c7934fd7a732f9aa1a3d24b84990e`:

- Ubuntu job `97806617299`: 9/9 PASS
- Windows job `97806617060`: 9/9 PASS

## Frozen profiles

### 1-block reference

- sequence length: 3
- vocabulary: 4
- hidden: 4
- FF: 5
- Q heads: 2
- KV heads: 1
- head dimension: 2
- block count: 1
- dtype/device: CPU f64

### 2-block cross-gradient

Same geometry, block count 2. Each block owns its own `wq/wk/wv/wo/w1/w2`; token embedding and LM head are model-level parameters.

## What is proven

1. The RCL semantic genome self-hosts with byte-identical bootstrap/native RBC and strict native semantic-state-root verification.
2. One-block and two-block graphs are emitted by the same parametric builder; block count is model topology, not duplicated demo code.
3. Two-block forward logits, both block outputs and next-token cross entropy agree with an independent JavaScript oracle.
4. The second block consumes the first block output directly; swapping block parameter sets changes loss, proving ordered composition is semantically observable.
5. All 14 trainable parameter groups in the two-block profile receive finite non-zero Reverse Autodiff gradients.
6. A first-block `wq` gradient and second-block `w2` gradient agree with central finite difference.
7. The first-block gradient differs between 1-block and 2-block graphs, while the 2-block finite-difference probe traverses the second block. This is the accepted cross-block gradient evidence.
8. Next-token cross entropy remains a composition of generic `softmax/log/mul/sum/mean`; no LM-special loss primitive is introduced.
9. Invalid block counts, invalid target geometry and duplicate parameter identities fail closed at the model-construction boundary.
10. Injected `multiblock-special` is rejected by the Tensor Engine.
11. The same profile validator admits the structural RCL-1B target of 24 blocks, 2048 hidden, 16 Q heads, 4 KV heads and head dimension 128. This is structural compatibility only, not a 1B execution claim.

## Canonical lowering

`embedding -> block[0] -> block[1] -> ... -> block[N-1] -> LM head -> generic cross entropy`

Each block is:

`RMSNorm -> GQA(Q/K RoPE + shared KV causal attention) -> residual -> RMSNorm -> SiLU FFN -> residual`

All execution remains generic Tensor/Autodiff. There is no `multiblock-special`, `decoder-special`, or GPT-specific VM opcode.

## Boundary retained

This evidence does **not** yet grant:

- multi-block AdamW training replay
- production ~64K vocabulary
- packed/fused multi-head representation
- BF16/FP16
- GPU/NPU
- DistributedTensor
- RCL-10M / 100M / 300M / 1B
- K400 promotion

The next scale-critical work is accelerator/mixed-precision execution; multi-block AdamW replay can be bound before the first RCL-10M training run.
