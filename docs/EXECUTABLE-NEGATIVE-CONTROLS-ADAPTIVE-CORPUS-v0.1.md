# RCL Executable Negative Controls and Adaptive Corpus Loop v0.1

## Purpose

Equivalence Corpus Forge produces deterministic cases and mutation plans, but a mutation plan is not evidence until it becomes executable. This layer closes that gap:

```text
source-extracted capability
→ corpus-forged cases and mutation plans
→ executable negative-control adapters
→ independent differential execution
→ coverage and mutation feedback
→ supplemental cases
→ content-addressed corpus revision
→ reexecution
```

The loop changes the test corpus. It does not silently change the absorbed implementation, source runtime, compiler, or native VM.

## Executable negative controls

`synthesizeExecutableNegativeControls()` consumes one capability corpus and one supplied baseline adapter. Each content-addressed mutation plan becomes a Differential Absorption negative-control adapter.

Supported v0.1 operators:

- `ignore_required`;
- `ignore_type`;
- `ignore_enum`;
- `allow_additional_properties`;
- `ignore_required_parameter`;
- `ignore_required_body`;
- `accept_undeclared_status`;
- `ignore_not_null`;
- `ignore_unique`;
- `ignore_foreign_key`.

The default implementation is an operator-level runtime wrapper. On bound detection cases it attempts to turn an observable rejection or error into acceptance. It does not add an arbitrary marker when the baseline already accepts the input. Therefore an over-permissive baseline remains undetected instead of producing a false pass.

### Blocked plans

A plan is blocked when it has no detection case, references a missing case, or has no executable operator handler. Blocked plans are not omitted. They become deliberately non-mutating controls, so Differential Absorption records them as undetected and refuses promotion eligibility.

## Content-addressed integrity

Before synthesis, the layer recomputes and verifies every case root, mutation-plan root, and capability-corpus root. A case, plan, or corpus changed under a stale root is rejected before execution.

## Corpus differential experiment

`runCorpusDifferentialExperiment()` combines corpus conversion, supplied source and absorbed adapters, synthesized negative controls, repeated Differential Absorption execution, and one rooted experiment envelope.

It preserves the existing Differential Absorption boundary: execution is in the current process and does not prove binary or process independence.

## Adaptive feedback

`analyzeCorpusFeedback()` inspects:

- source/absorbed semantic mismatches;
- nondeterministic replay;
- infrastructure failures;
- unbound or unexecuted mutation plans;
- negative controls that were not detected.

For supported operators it proposes deterministic probes such as an undeclared OpenAPI response status, a stronger duplicate-key transaction, a missing foreign-reference sentinel, or an additional JSON property.

## Adaptive revision

`materializeAdaptiveCorpusRevision()` produces `rcl.adaptive-capability-equivalence-corpus.v0.1` with the base corpus root, adaptation-cycle root, original and supplemental cases, rebound mutation plans, and an explicit reexecution requirement. The revision carries no new runtime result or equivalence verdict.

## Bounded loop

`runAdaptiveCorpusLoop()` defaults to three iterations and permits at most eight:

```text
execute corpus
→ analyze feedback
→ sufficient? stop
→ supplemental cases available? revise and rerun
→ otherwise block
```

Terminal statuses:

- `converged`;
- `stable-but-not-promotion-eligible`;
- `blocked`;
- `max-iterations`.

Convergence requires a gap-free final cycle and a promotion-eligible final differential experiment.

## Public API

```js
verifyExecutableCorpusIntegrity(corpus)
synthesizeExecutableNegativeControls(corpus, options)
runCorpusDifferentialExperiment(request)
analyzeCorpusFeedback(request)
materializeAdaptiveCorpusRevision(request)
runAdaptiveCorpusLoop(request)
```

## Evidence boundary

The v0.1 proof level is `operator-level-runtime-wrapper`:

- source code, ASTs, binaries, and external processes are not rewritten;
- adapters execute in the current Node.js process;
- supplemental cases are proposals until rerun;
- convergence is bounded to supplied adapters, generated corpus, implemented operators, and iteration budget;
- Native Promotion remains a separate later gate.

## Verification

```bash
node --test tests/003-executable-negative-controls-adaptive-loop.test.mjs
node examples/executable-negative-controls-adaptive-loop-demo.mjs
```
