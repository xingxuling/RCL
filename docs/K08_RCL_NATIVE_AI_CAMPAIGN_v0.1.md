# K08 RCL-Native AI Campaign v0.1

**Native-learning milestone:** `PASS_LOCAL_WINDOWS_NATIVE_AI_N2`
**K400 cell:** `K233 ai-runtime::machine-learning = BLOCKED_GITHUB_AI_GENERATE_REPLAY`
**Maturity:** `AI-N2` for the bounded two-Dense-layer General MLP profile
**Evidence report root:** `30109639721ced8e0afb1e0edd6b5f44d76de9e94016ad82dc3ce4d33e83c330`
**Date:** 2026-08-25

## 1. Audit boundary

The existing RCL Neuro Forge trains its MLP in `src/forge/neuro-forge.mjs`. RCL authorizes the provider result and governs deployment, but it does not execute that training math. Neuro Forge is therefore frozen as `OPAQUE_DELEGATION_PROVIDER_ORACLE_ONLY`; it is not Native AI evidence.

K08-A uses this pure execution path:

```text
examples/native-ai/pure-rcl-xor.rcl
  -> native/rclc.exe executing selfhost/compiler.rbc
  -> pure-rcl-xor.rbc
  -> native/rclvm.exe
  -> forward / loss / backprop / Batch SGD / training / inference state
```

No Python, JavaScript trainer, ML framework, external autodiff, optimizer, model API or provider opcode participates in the parameters used by this path. The JavaScript implementation in the campaign runner is a post-run differential oracle only.

## 2. Frozen contract

The contract was written before the first native run:

- XOR dataset: `(0,0)->0`, `(0,1)->1`, `(1,0)->1`, `(1,1)->0`;
- architecture: fully connected `2-2-1` MLP;
- activation: `0.5 + 0.5*x/(1+abs(x))` with its analytic derivative;
- loss: mean half-squared error;
- optimizer: Batch SGD;
- seed: `42`, with nine materialized initialization values;
- epochs: `512`;
- learning rate: `4`;
- acceptance: accuracy `1`, loss `<= 0.03`, maximum prediction error `<= 0.25`;
- robustness: three byte-identical/native-state deterministic replays;
- differential tolerance: `1e-9`.

Softsign-01 was selected because it is nonlinear and differentiable while lowering entirely through existing RCL arithmetic, comparison, `choose`, recursive `reckon` and immutable `Sequence` semantics. K08-A adds no XOR or ML-special-case VM primitive.

## 3. Measured result

The local Windows receipt records:

| Evidence | Result |
|---|---:|
| RBC bytes | `11,640` |
| RBC instructions | `671` |
| Training execution instructions | `13,965,818` |
| Native replay semantic root | `9d395b42a0c93c5fbe29174aa8308e1cabd6d346c1543a5aa65d185741f321c2` |
| Deterministic replays | `3 / 3` |
| Accuracy | `1.0` |
| Loss | `0.0157034488743931` |
| Outputs | `[0.182866, 0.825711, 0.825717, 0.177304]` |
| Maximum parameter drift vs oracle | `4.44e-15` |
| Local median Native VM time | `188.705 ms` |

Native peak RSS is not emitted by the current VM and remains explicitly `UNMEASURED`. The JavaScript oracle remains faster and is recorded as an `UNABSORBED_ADVANTAGE`; K08-A proves `Can Compute`, not competitive performance.

The post-change full repository regression passed `834 tests / 833 pass / 0 fail / 1 skip` in `493,017.7984 ms`. The single skip is the existing external DLL import-library load check when Zig is unavailable; the checked Windows native distribution remains source/hash-manifest verified.

## 4. Gate verdict

| Gate | Status | Boundary |
|---|---|---|
| EXPRESS | PASS | dataset, parameters, activation, forward, loss, gradients, backward update, training, prediction and evaluation are `.rcl` reckons/facets |
| COMPILE | PASS | native `rclc` + `compiler.rbc` produced the target |
| LOWER | PASS | native target is byte-identical to the JS reference compiler output |
| EXECUTE | PASS | target executed in native `rclvm` |
| CORRECT | PASS | all four XOR outputs and frozen loss/error thresholds passed |
| ROBUST | PASS | three exact state replays and one semantic root |
| PERFORMANCE | PASS | measured locally; no parity claim |
| AI_GENERATE | UNVERIFIED | requires an independent receipt |
| EVIDENCE | PASS | roots cover contract, dataset, model, initialization, trace, final parameters, checkpoint, evaluation, source, compiler and RBC |

This permits the scoped statement:

```text
RCL Native Learning: PROVEN AT MINIMAL MLP SCALE
```

K08-A alone does not permit claims of a general MLP, Tensor Genome, native autodiff, general optimizer genome, Transformer, language model, GPU/NPU lowering, production model lifecycle or self-generating RCL. K08-B below separately establishes only its bounded AI-N2 General MLP profile.

## 5. Reproduction

```text
npm run build:native
npm run evidence:k08-native-ai
node --test tests/k08-pure-rcl-xor.test.mjs
npm run evidence:k400
```

Tracked receipt files live under `examples/native-ai/evidence/`. CI reruns the native campaign and uploads its generated evidence separately.

## 6. K08-B General MLP closure

K08-B now represents `Model`, `Layer`, `Parameter`, `Activation`, `Loss`, `Optimizer`, `Dataset` and `Checkpoint` as tagged RCL semantic values. One generic-width two-Dense-layer profile trains both the original XOR task and a structurally different three-input Majority task.

The accepted local native receipt records:

- XOR `2-2-1`: accuracy `1`, loss `0.0157034488743931`;
- Majority-3 `3-3-1`: accuracy `1`, loss `0.0111015956287353`;
- exact `32 == 16 + resume(16)` checkpoint parity;
- invalid adjacent layer width and invalid dataset width rejected;
- three identical native state roots;
- native/self-host and JS reference RBC byte parity;
- maximum parameter drift below `5.4e-15`;
- zero provider opcode and no task-specific VM opcode.

Three independent, read-only Codex sessions also repaired three distinct hidden K08-A semantic mutations. Their exact edits restore canonical source bytes and replay locally, but they remain `CANDIDATE` until GitHub-hosted verification succeeds.

Evidence and decisions: `docs/native-ai/evidence-ledger.md`, `docs/native-ai/integration-court.md`, and `docs/native-ai/rcl-gap-register.md`.

## 7. Next gate

K08-B has removed XOR-specific topology assumptions without adding an `xor_special` primitive. The current highest-value sequence is:

1. complete the GitHub-hosted replay and bind the run SHA/URL into the independent receipt;
2. regenerate K400 evidence only after that external replay;
3. begin Tensor Genome with shape/dtype/layout and fail-closed broadcast/matmul semantics;
4. add native peak-memory telemetry;
5. preserve the JavaScript performance gap as a donor advantage until a CPU Tensor backend absorbs it.
