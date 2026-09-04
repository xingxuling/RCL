# AI003 Multi-Block AdamW Replay Candidate

**Status:** `PASS_SCOPE_BOUND_HOSTED_CANDIDATE`

**Canonical semantic owner:** RCL

**Execution organ:** Rust generic Tensor + Reverse Autodiff + AdamW CPU-f64 backend.

## What was already implemented and is now registered

The K08-R profile runs the same generic Tensor graph through two ordered GQA/RoPE decoder blocks and updates all fourteen canonical parameter identities with AdamW. It has no multi-block or model-special optimizer opcode.

The replay contract covers:

- fourteen unique model and block-scoped trainable identities;
- finite, correctly bound first/second AdamW moments for every identity;
- decreasing next-token loss;
- exact direct-training versus checkpoint-plus-resume continuation;
- deterministic replay with identical parameters, optimizer states and checkpoint root;
- fail-closed malformed optimizer-state binding.

## Evidence

```text
node --test --test-concurrency=1 tests/k08-multiblock-adamw.test.mjs
8/8 PASS
```

The exact PR-head hosted replay is GitHub Actions run `33888428286` on commit `7717296f38326ea30ba82951adecbf95254e851e`: Ubuntu job `101073862101` and Windows job `101073862513` both passed.

## Boundary

This closes the bounded CPU-f64 two-block AdamW replay slice of AI-003. It does not grant BF16 multi-block training, full GPU training, packed/fused attention, RCL-10M admission, distributed training, RCL-1B completion, production convergence or K400 promotion. Those remain separate scale/backend/data gates.
