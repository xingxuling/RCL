# K08-H Optimizer Genome Evidence v0.1

**Status:** `ENGINE_E3_OPTIMIZER_GENOME_CANDIDATE_GITHUB_REPLAY_BOUND`

**Scope:** model-agnostic scalar f64 optimizer semantics in RCL for SGD, Momentum, Adam and AdamW. This document does not grant Transformer, Tiny LM, accelerator, distributed-training or K400 promotion claims.

## Canonical ownership

RCL owns optimizer identity, hyperparameters, gradient clipping, step/moment state, update semantics and checkpoint/reload intent. Optimized Tensor/GPU implementations may lower these semantics into execution organs later.

Canonical source and contract:

- `examples/native-ai/optimizer-genome.rcl`
- `examples/native-ai/optimizer-genome-contract.v0.1.json`

No `xor_special`, `mlp_special`, `transformer_special` or `gpt_special` path exists.

## Frozen AdamW profile

- initial parameter: `1`
- gradient: `0.5`
- learning rate: `0.01`
- beta1: `0.9`
- beta2: `0.999`
- epsilon: `1e-8`, expressed canonically as `1 / 100000000`
- decoupled weight decay: `0.1`
- gradient clip: `1`

The scalar RCL reference implements bias-corrected Adam and decoupled AdamW weight decay. A separate JavaScript implementation is used only as a differential oracle.

## Verification

GitHub Actions run `32837463615` passed on both hosted platforms for exact candidate commit `87a873249c6969cddd24422d5e9cab5df6350008`:

- Ubuntu job `97769427308`: success
- Windows job `97769427507`: success

Both jobs successfully completed:

1. native compiler/VM build;
2. self-host canonical source-root diagnostic;
3. K08-H Optimizer Genome test suite.

The Optimizer suite reports `4/4` pass:

- contract / anti-overclaim boundary;
- native self-host compile + native execution;
- independent JavaScript AdamW differential oracle;
- anti-model-special source audit.

The native execution test additionally requires:

- verified native semantic state root;
- SGD fixture correctness;
- Momentum fixture correctness;
- Adam fixture correctness;
- AdamW first and second update correctness;
- exact checkpoint-resume equality;
- invalid optimizer configurations rejected;
- optimizer-state/config identity binding.

## Self-host canonicalization gap discovered during the campaign

The initial campaign exposed a compiler-level provenance mismatch: self-host and bootstrap RBC had identical byte length, numeric pool and instruction stream, but different `sourceRoot` values.

A feature-isolation matrix proved that ordinary facets, reckon calls, recursion, boolean chains, `not`, nested `Sequence`, seven-argument functions, nested `choose`, integer division and the Optimizer config shape all preserve root parity. The isolated reproducer is the decimal literal `0.000001`.

The diagnostic freezes this as a known language-level canonicalization gap:

- `tests/k08-selfhost-root-drift-diagnostic.test.mjs`
- `micro-decimal-known-gap` is expected to differ only in source root;
- numeric pools, executable instructions and all strings except the root remain identical.

The Optimizer Genome does not silently ignore the gap. Numerically small constants required by the profile are represented as exact arithmetic expressions (`1 / 100000000` for epsilon and `1 / 1000000` for tolerance) so runtime values remain unchanged while self-host RBC parity is preserved.

This is a general RCL compiler/evidence issue, not an AdamW or model-specific exception, and should remain tracked beside the existing canonical-number/scientific-number root gaps.

## Integration verdict

`ENGINE-E3` is admitted as a **candidate with hosted cross-platform evidence** for the frozen scalar f64 profile.

What is established:

- RCL can canonically represent optimizer configuration and state;
- SGD, Momentum, Adam and AdamW update semantics execute natively;
- AdamW agrees with an independent differential oracle;
- optimizer state survives checkpoint materialization/reload exactly inside the frozen profile;
- invalid configuration and state-binding conditions fail closed;
- no model-specific optimizer primitive is required.

What is not established:

- Tensor-wide optimizer kernel/backend;
- production mixed-precision AdamW;
- Transformer or Tiny LM training;
- accelerator execution;
- distributed optimizer state;
- K400 promotion from this candidate alone.

## Next target

Proceed to `ENGINE-E4`: generic Transformer primitives and the first Decoder-only Transformer block using the existing Tensor + Reverse-Mode Autodiff + Optimizer Genome stack.
