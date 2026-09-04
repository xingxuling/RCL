# AI002: self-hosted Autodiff graph-governance candidate v0.1

This candidate absorbs the reusable computation-graph semantic boundary into
executable RCL. For an ordered graph, RCL now owns:

- parameter and operation identity plus GradientIdentity presence;
- duplicate-id/output and forward-reference rejection;
- the declared differentiable-operation set and reverse-rule names;
- StopGradient filtering;
- deterministic reverse traversal and BackwardEdge formation; and
- per-parameter GradientAccumulator contribution grouping.

The RCL source executes through the native VM. The JavaScript bridge only
renders graph input and decodes the semantic result. The focused suite covers
a matmul/mean graph, a parameter used by multiple operations, selective
StopGradient, and invalid duplicate/forward/unsupported inputs.

## Evidence boundary

This is a `PASS_SCOPE_BOUND_LOCAL_CANDIDATE` for graph planning semantics. It
does not claim numeric derivative correctness, tensor kernel execution,
optimizer behavior, GPU execution, distributed autodiff, production training
or K400 promotion. Numeric kernels and their performance remain Provider or
lowering evidence.

Still open under AI002:

- shape-aware reverse rules and broadcast/unbroadcast proof across the full
  Tensor type graph;
- graph reachability, common-subexpression identity and arbitrary topological
  ordering beyond this ordered candidate;
- numeric reverse execution differential coverage for every rule;
- canonical self-host compiler promotion and larger graph corpus replay.
