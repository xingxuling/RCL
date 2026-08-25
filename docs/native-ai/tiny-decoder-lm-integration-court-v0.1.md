# K08-J Tiny Decoder LM Integration Court v0.1

## Target ruling

Admit the bounded first RCL-native Tiny Decoder Language Model as an ENGINE-E5 hosted candidate.

## Federation verdicts

- Founder Twin: PASS — the result advances RCL from model primitives to an end-to-end learnable language-model lifecycle without redefining RCL as a GPT-only language.
- 柳清莲 Gate: PASS — all scale and product-quality claims remain explicitly bounded.
- 洞哥 Grounding: PASS — hosted Ubuntu/Windows jobs execute the native compiler/VM and Rust Tensor/Autodiff engine; no imagined device/GPU evidence is claimed.
- Product civilization: PASS — this is the first vertical slice that consumes tokens, trains a next-token objective and emits generated tokens.
- UX/design civilization: N/A — no user-facing interface changed.
- Engineering civilization: PASS — additive branch, explicit rollback, bounded fixed profile.
- Code civilization: PASS — language-model behavior is composed from generic Tensor/Autodiff primitives; no model-special opcode.
- Test civilization: PASS — self-host parity, state root, gradient connectivity, training convergence, deterministic replay, generation and fail-closed negative control.
- Security civilization: PASS for bounded scope — unsupported model-special operations fail closed; no new external authority surface.
- Release civilization: PASS for ENGINE-E5 candidate only — no production model quality or large-scale release claim.
- Integration Court: PASS.

## Hosted gate

Workflow `K08 Tiny Decoder LM v0.1`, run `32840160638`:

- Ubuntu `97777660616`: success
- Windows `97777660514`: success
- six focused tests pass on both platforms

## Acceptance criteria satisfied

- RCL semantic genome compiles through the self-host compiler with byte parity to bootstrap RBC.
- Native semantic state root verifies.
- Cross-entropy is composed from generic Tensor operations.
- Every admitted trainable tensor receives finite reverse-mode gradients.
- 80 native Batch-SGD steps reduce loss by at least 25%, with final loss below 0.55.
- A second frozen training run is exactly deterministic.
- Trained parameters generate the expected continuation `ABCABC` from seed `ABCABC` under greedy autoregressive decoding.
- Injecting a `gpt-special` Tensor operation is rejected.

## Boundaries

The court does not grant general tokenizer, learned/RoPE position semantics, multi-head attention, Tensor AdamW, GPU/NPU, distributed training, large-model scale, natural-language quality or K400 promotion.

## Rollback

Revert the K08-J campaign merge. No existing compiler/VM/Tensor/Autodiff/Optimizer/K08-I production semantics are modified by this candidate.

## Next court target

The highest-leverage next target is the Tensor AdamW bridge, followed by a general tokenization/position pipeline and multi-head/multi-block scale-up before accelerator work.
