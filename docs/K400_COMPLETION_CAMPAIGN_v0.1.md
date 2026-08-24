# K400 Completion Campaign v0.1

**Verdict:** `INCOMPLETE`
**Current evidence:** `0 PASS / 7 BLOCKED / 393 UNTESTED`
**Maturity:** `U0`
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

The checked-in input is deterministically rebuilt from the current Native UI evidence and the historical K02/K03 direct receipts. Historical receipts retain their original verification dates and blockers.

## 3. Nearest closures

| Stable cell | Coordinate | Current state | Missing gates |
|---|---|---|---|
| `K064` | `browser::web` | `BLOCKED` | `AI_GENERATE` |
| `K339` | `compiler-runtime::self-hosting` | `BLOCKED` | `AI_GENERATE` |
| `K063` | `browser::gui` | `BLOCKED` | `PERFORMANCE`, `AI_GENERATE` |
| `K078` | `browser::reactive` | `BLOCKED` | `PERFORMANCE`, `AI_GENERATE` |
| `K083` | `android::gui` | `BLOCKED` | device `EXECUTE`, `CORRECT`, `PERFORMANCE`, `AI_GENERATE` |
| `K085` | `android::mobile` | `BLOCKED` | device `EXECUTE`, `CORRECT`, `PERFORMANCE`, `AI_GENERATE` |
| `K098` | `android::reactive` | `BLOCKED` | device `EXECUTE`, `CORRECT`, `PERFORMANCE`, `AI_GENERATE` |

`AI_GENERATE` requires independent, reproducible generation or repair receipts. The development process that authored the implementation cannot mark its own work as independent evidence. Android build artifacts are not device execution evidence.

## 4. Closure order

1. Close `K064` and `K339` through a separately executed, receipt-bound AI generation/repair contract.
2. Pre-register browser performance budgets and rerun real-browser trials for `K063` and `K078`.
3. Acquire emulator or device installation, interaction, correctness and timing receipts for `K083`, `K085` and `K098`.
4. Add reusable campaign adapters for the remaining killer tasks before expanding into adjacent matrix cells.
5. Rerun regression and regenerate the complete 400-cell report after every evidence generation.

## 5. Evidence integrity

The report runner rejects duplicate claims, unknown coordinates, conflicting environment/program metadata, unknown gates, invalid statuses and malformed source SHA/date fields. Missing gates remain `BLOCKED`; unclaimed cells remain `UNTESTED`.

The report root excludes volatile generation time but includes semantic report content. It is evidence integrity, not proof that the underlying external execution occurred.

## 6. Browser performance contract chronology

Commit `955e6cef527f74a926538d5f8d2b93404add245b` froze the numeric browser budgets before the new acquisition. The first acquisition met every numeric budget but failed the UI-root precondition because the checked-in Counter evidence was stale relative to the device-adaptation IR fields. Revision 2 corrects only that identity precondition to the freshly regenerated canonical root; it does not change either numeric threshold. A new acquisition must occur after the revision-2 commit before `K063` or `K078` performance can be promoted.
