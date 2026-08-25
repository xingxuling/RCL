# K08-Q Mixed Precision Integration Court v0.1

## Target ruling

Admit bounded BF16 canonical storage/compute semantics with FP32 accumulation as a GitHub-replay-bound correctness organ, while keeping every accelerator and mixed-precision-training claim closed until separately evidenced.

## Founder Twin

The target is not “GPU-shaped code.” The target is a numerical contract that survives backend substitution. BF16 must have one canonical rounding rule, exact evidence-bearing bit identity, and an explicit accumulation policy before CUDA/Vulkan/Metal organs are allowed to claim semantic continuity.

## Gate ruling

**PASS as bounded candidate.**

Reason:

- BF16 bit semantics are explicit and executable;
- independent oracle parity is present;
- storage identity is deterministic;
- failure boundaries are closed;
- unsupported accelerators cannot silently route to CPU;
- no GPU claim is inferred from CPU execution.

## Grounding

Hosted replay `32850137410` passed on both Ubuntu and Windows:

- Ubuntu `97808869047`: 10/10
- Windows `97808868747`: 10/10

The replay validates source self-hosting, exact BF16 patterns, ties-to-even rounding, deterministic roots, BF16 MatMul/add/mul parity, bounded f64 drift, fail-closed numeric/shape behavior, and strict accelerator-unavailable behavior.

## Product / user value

This milestone removes ambiguity from a future accelerator port. A CUDA/Vulkan/NPU backend now has a concrete reference target rather than a loose “use BF16 somehow” instruction. That materially reduces the chance that a fast backend silently changes model reality.

## Engineering civilization

Accepted architecture:

`canonical BF16 semantics -> CPU reference oracle -> future accelerator lowerings`

The CPU oracle remains correctness authority for this bounded numerical profile. Hardware organs may optimize representation and kernel fusion, but must differentially match the contract within a declared numerical envelope.

## Code civilization

Accepted implementation properties:

- real BF16 bit conversion, not f32 relabeling;
- round-to-nearest ties-to-even;
- exact 16-bit storage payloads;
- FP32 accumulation for MatMul;
- BF16 output requantization;
- content-addressed storage identity;
- no `gpu-special` semantic ownership transfer to a backend;
- no silent accelerator fallback.

## Test civilization

Required evidence is satisfied for the bounded reference profile. The following remain mandatory future tests, not implied successes:

- Reverse Autodiff through a mixed-precision graph;
- FP32 gradient/master-weight handling;
- multi-block mixed-precision training;
- dynamic/static loss-scaling behavior if introduced;
- actual GPU device identity and execution telemetry;
- accelerator-vs-reference differential parity;
- long-context and large-shape numerical envelopes.

## Safety civilization

Fail-closed behavior is mandatory for:

- non-finite/overflowing values outside the admitted reference policy;
- invalid shapes;
- unavailable accelerator backends;
- any request that would otherwise silently downgrade execution authority.

A software renderer or CPU emulation path must never be counted as real GPU evidence.

## Release civilization

Admit K08-Q as:

`MIXED_PRECISION_REFERENCE_CANDIDATE_GITHUB_REPLAY_BOUND`

Do not grant:

`GPU`, `CUDA`, `VULKAN_GPU`, `BF16_AUTODIFF_TRAINING`, `MULTI_BLOCK_BF16_TRAINING`, `RCL_10M`, `DISTRIBUTED_TRAINING`, `RCL_1B_COMPLETE`, or `K400_PROMOTION`.

## Evidence Ledger

- semantic genome: `examples/native-ai/mixed-precision-genome.rcl`
- contract: `examples/native-ai/mixed-precision-contract.v0.1.json`
- reference organ: `native/tensor-engine/src/bin/rcl-mixed-precision.rs`
- tests: `tests/k08-mixed-precision.test.mjs`
- workflow: `.github/workflows/k08-mixed-precision.yml`
- accepted run: `32850137410`
- source commit: `8fb85604a15973708fe91f5886672773bfa11825`
- Ubuntu job: `97808869047`
- Windows job: `97808868747`

## Next court

The next admission should target **multi-block AdamW replay** and then **BF16 Autodiff / mixed-precision training**, while real GPU admission remains blocked on real accelerator evidence.
