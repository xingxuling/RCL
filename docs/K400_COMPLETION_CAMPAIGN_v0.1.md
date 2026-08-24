# K400 Completion Campaign v0.1

**Verdict:** `INCOMPLETE`
**Current evidence:** `0 PASS / 8 BLOCKED / 392 UNTESTED`
**Maturity:** `U0`
**Report root:** `d00b3aaad4554e045d4ec27382c720b7c4157501dd6ae3d4890253f2af496287`
**Date:** 2026-08-25

## 1. Completion contract

K400 means the permanent `20 environments × 20 program families` matrix, not one demo and not the twelve killer-task labels. Each row-major cell has a stable identity from `K001` through `K400` plus its semantic coordinate.

Completion requires all of the following simultaneously:

- exactly 400 unique, known cells;
- every cell passes `EXPRESS`, `COMPILE`, `LOWER`, `EXECUTE`, `CORRECT`, `ROBUST`, `PERFORMANCE`, `AI_GENERATE` and `EVIDENCE`;
- no cell is `FAIL`, `BLOCKED`, `UNTESTED` or `REGRESSED`;
- no task-specific special case receives universal-growth credit;
- no opaque delegation is counted as universal-language growth.

The evaluator exposes separate `evidenceComplete` and `universalGrowthComplete` fields. Even 400 provider-only PASS results cannot produce `COMPLETE`.

## 2. Current authoritative report

Run:

```text
npm run evidence:k400
```

Inputs and outputs:

```text
examples/universal-stress/k400-current-evidence.json
output/universal-stress-k400/universal-stress-report.json
output/universal-stress-k400/universal-stress-report.md
```

The checked-in input is deterministically rebuilt from the current Native UI evidence, the historical K02/K03 direct receipts and the K08-A Pure RCL XOR native receipt. Historical receipts retain their original verification dates and blockers.

## 3. Nearest closures

| Stable cell | Coordinate | Current state | Missing gates |
|---|---|---|---|
| `K064` | `browser::web` | `BLOCKED` | `AI_GENERATE` |
| `K339` | `compiler-runtime::self-hosting` | `BLOCKED` | `AI_GENERATE` |
| `K063` | `browser::gui` | `BLOCKED` | `AI_GENERATE` |
| `K078` | `browser::reactive` | `BLOCKED` | `AI_GENERATE` |
| `K233` | `ai-runtime::machine-learning` | `BLOCKED` | `AI_GENERATE`; minimal XOR scope does not establish general ML |
| `K083` | `android::gui` | `BLOCKED` | device `EXECUTE`, `CORRECT`, `PERFORMANCE`, `AI_GENERATE` |
| `K085` | `android::mobile` | `BLOCKED` | device `EXECUTE`, `CORRECT`, `PERFORMANCE`, `AI_GENERATE` |
| `K098` | `android::reactive` | `BLOCKED` | device `EXECUTE`, `CORRECT`, `PERFORMANCE`, `AI_GENERATE` |

`AI_GENERATE` requires independent, reproducible generation or repair receipts. The development process that authored the implementation cannot mark its own work as independent evidence. Android build artifacts are not device execution evidence.

## 4. Closure order

1. Close `K064`, `K233` and `K339` through separately executed, receipt-bound AI generation/repair contracts.
2. Acquire emulator or device installation, interaction, correctness and timing receipts for `K083`, `K085` and `K098`.
3. Add reusable campaign adapters for the remaining killer tasks before expanding into adjacent matrix cells.
4. Rerun regression and regenerate the complete 400-cell report after every evidence generation.

## 5. Evidence integrity

The report runner rejects duplicate claims, unknown coordinates, conflicting environment/program metadata, unknown gates, invalid statuses and malformed source SHA/date fields. Missing gates remain `BLOCKED`; unclaimed cells remain `UNTESTED`.

The report root excludes volatile generation time but includes semantic report content. It is evidence integrity, not proof that the underlying external execution occurred.

CI keeps the matrix/report and cross-platform K08-A native XOR job on Linux and runs K01 in a separate Windows job because the current K01 native boundary explicitly requires `NATIVE_WINDOWS_VERIFIED`. A Linux host failure cannot be relabeled as a K01 semantic failure or PASS; Windows build, fixed-point and stage receipts remain non-compensatory.

The first Windows CI receipt passed native execution, fixed point and 40 later stages but exposed stale Stage0 source hashes after the Native UI/Frontier merge (`40/41`). The five changed module hashes are now rebound in `selfhost/rcl-source-selfhost-stage0.rcl`, and a regular test executes the Stage0 verifier so this provenance drift can no longer hide outside the default suite.

## 6. K08-A Native AI closure

`pure-rcl-xor.rcl` owns the frozen dataset, nine parameters, Softsign-01 activation, forward pass, mean half-squared loss, manual gradients, backward propagation, Batch SGD, 512-epoch training loop, prediction and evaluation. Native `rclc` compiled it through `selfhost/compiler.rbc`; native `rclvm` executed 13,965,818 instructions and reached 100% XOR accuracy with loss `0.0157034488743931`. Three replays produced the same semantic state root, while the JS differential oracle had maximum parameter drift `4.44e-15` and did not supply native parameters.

This proves Native Learning only at the minimal frozen MLP scale. `K233` remains `BLOCKED` because `AI_GENERATE` is separate; Tensor, Autodiff, optimizer genomes, general MLP and accelerated backends are not implied. See `docs/K08_RCL_NATIVE_AI_CAMPAIGN_v0.1.md`.

## 7. Browser performance contract chronology

Commit `955e6cef527f74a926538d5f8d2b93404add245b` froze the numeric browser budgets before the new acquisition. The first acquisition met every numeric budget but failed the UI-root precondition because the checked-in Counter evidence was stale relative to the device-adaptation IR fields. Revision 2 corrected only that identity precondition to the freshly regenerated canonical root and did not change either numeric threshold. The post-revision real Chrome acquisition passed all checks at `0.884 ms` per three-event sequence against the `1.5 ms` limit and `1037.344 ms` host-process elapsed time against the `5000 ms` limit. This closes only the declared local performance gate; the roughly `49.1×` plain-DOM slowdown remains an observed donor advantage rather than a parity claim.
