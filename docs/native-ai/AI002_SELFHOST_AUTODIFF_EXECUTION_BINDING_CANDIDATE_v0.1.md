# AI002 self-hosted Autodiff execution-binding candidate v0.1

## Decision

This candidate closes one bounded part of `RCL_GAP_AI_002`: RCL-owned typed
Tensor shape admission and RCL-owned graph-governance admission now gate a
generic numeric reverse-mode execution organ.

The implementation deliberately composes the existing AI001 and AI002
genomes. It does not create a second Autodiff dialect or move numerical kernel
ownership into the RCL VM.

## RCL-owned semantics

- Tensor descriptor identity, dimensions, row-major strides, dtype/layout/
  device profile and operation output shapes;
- graph identity, topological references, differentiable-operation policy,
  StopGradient filtering and deterministic reverse-edge order;
- binding of every provider edge to the accepted RCL plan;
- gradient shape agreement as an acceptance condition.

## Provider-owned lowering

The generic `rcl-tensor-autodiff-rust-v0.1` organ owns CPU-f64 numeric kernels
and reverse execution. The bridge accepts its result only after the RCL
admissions pass. An unsupported provider profile or a shape/edge mismatch
stops before provider execution; no CPU fallback is inferred for an unregistered
provider.

## Evidence

`npm run test:selfhost-autodiff-graph-execution` passes `4/4` locally. The
evidence generator records valid shape/graph/storage admission, provider
execution, reverse-edge parity, gradient-shape parity and fail-closed negative
controls in:

`evidence/RCL_GAP_AI002_SELFHOST_AUTODIFF_EXECUTION_BINDING_CANDIDATE_v0.1.json`

The local receipt root is
`513ddd98ca8d78be651ca0daccac7e5068ddeabeee691c5e587f173ede5a3722`, bound to
implementation commit
`fb45a29eb3c995781b79478722ecf2dfea707c7c`.

## Not granted

This is a candidate-only closure. It does not grant GPU-native backward or
optimizer kernels, broad graph/shape coverage, distributed execution,
production Transformer training, canonical RCL promotion or a K400 PASS.

