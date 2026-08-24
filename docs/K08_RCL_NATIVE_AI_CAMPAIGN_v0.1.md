# K08 RCL-Native AI Campaign v0.1

**Native-learning milestone:** `PASS_LOCAL_WINDOWS_NATIVE`
**K400 cell:** `K233 ai-runtime::machine-learning = BLOCKED_AI_GENERATE`
**Maturity:** `AI-N1` at the frozen minimal-MLP scope only
**Evidence report root:** `d7f33073c484cae7dec818e6628bc49444956254ce1d13f2246164a3d7e4526c`
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

It does not permit claims of a general MLP, Tensor Genome, native autodiff, general optimizer genome, Transformer, language model, GPU/NPU lowering, production model lifecycle or self-generating RCL.

## 5. Reproduction

```text
npm run build:native
npm run evidence:k08-native-ai
node --test tests/k08-pure-rcl-xor.test.mjs
npm run evidence:k400
```

Tracked receipt files live under `examples/native-ai/evidence/`. CI reruns the native campaign and uploads its generated evidence separately.

## 6. Next gate

K08-B must remove XOR-specific topology assumptions and introduce a configurable general MLP without adding an `xor_special` primitive. The current highest-value sequence is:

1. obtain independent `AI_GENERATE` evidence for K233 without reusing this implementation session as its own judge;
2. define a configurable layer/model representation and model save/load contract;
3. rerun XOR through that general representation;
4. test the same primitives on at least one non-XOR task before considering any Tensor Genome promotion;
5. add native peak-memory telemetry and preserve the JavaScript performance gap as a donor advantage until absorbed.
