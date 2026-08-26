# K400 Completion Campaign v0.1

**Verdict:** `INCOMPLETE`
**Current evidence:** `13 PASS / 0 BLOCKED / 387 UNTESTED`
**Maturity:** `U3`
**Report root:** `86ca5d246c8fc1f192987ee7c1bd070f31046f232edd11436abe2561a8094204`
**Date:** 2026-08-26

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

The checked-in input is deterministically rebuilt from the current Native UI evidence, the historical K02/K03 direct receipts, the rooted Server Web/Reactive batch and the K08-B General MLP native receipt. K08-A remains the minimal baseline inside that campaign. Historical receipts retain their original verification dates and blockers.

## 3. Nearest closures

| Stable cell | Coordinate | Current state | Missing gates |
|---|---|---|---|
| `K064` | `browser::web` | `PASS` | none for the bounded K02 RCL Web/Server vertical slice |
| `K327` | `compiler-runtime::compiler` | `PASS` | none for the bounded three-mutation builtin-lowering repair profile with admitted compiler-runtime binding |
| `K339` | `compiler-runtime::self-hosting` | `PASS` | none for the bounded three-mutation compiler repair profile |
| `K063` | `browser::gui` | `PASS` | none for the bounded K02 structural GUI surface |
| `K078` | `browser::reactive` | `PASS` | none for the bounded K02 reactive state/binding surface |
| `K233` | `ai-runtime::machine-learning` | `PASS` | none for the bounded AI-N2 General MLP profile; broader Tensor/Autodiff/Transformer work is separate |
| `K083` | `android::gui` | `PASS` | none for the bounded K03 Android GUI slice |
| `K085` | `android::mobile` | `PASS` | none for the bounded K03 mobile transaction slice |
| `K098` | `android::reactive` | `PASS` | none for the bounded K03 reactive/lifecycle slice |
| `K124` | `server::web` | `PASS` | none for the bounded generated Node loopback Web/server profile |
| `K138` | `server::reactive` | `PASS` | none for the bounded generated Node loopback reactive profile |
| `K321` | `compiler-runtime::algorithm` | `PASS` | none for the bounded frozen recursive GCD/Fibonacci/sum-of-squares native CLI profile |
| `K322` | `compiler-runtime::cli` | `PASS` | none for the same bounded native compiler-to-CLI execution profile |

`AI_GENERATE` requires independent, reproducible generation or repair receipts. The development process that authored the implementation cannot mark its own work as independent evidence. Android build artifacts are not device execution evidence.

## 4. Closure order

1. Add reusable campaign adapters for the remaining killer tasks before expanding into adjacent matrix cells.
2. Prioritize cells that can reuse the admitted compiler, Web, Android and native-AI genomes without inventing task-specific shortcuts.
3. Preserve the API 35 emulator installation, interaction, lifecycle and timing receipt as a bounded non-compensatory runtime gate.
4. Rerun regression and regenerate the complete 400-cell report after every evidence generation.

## 5. Evidence integrity

The report runner rejects duplicate claims, unknown coordinates, conflicting environment/program metadata, unknown gates, invalid statuses and malformed source SHA/date fields. Missing gates remain `BLOCKED`; unclaimed cells remain `UNTESTED`.

The report root excludes volatile generation time but includes semantic report content. It is evidence integrity, not proof that the underlying external execution occurred.

CI keeps the matrix/report, K02 and K233 receipt replay, K08-A native XOR baseline and K08-B General MLP campaign on Linux. It runs K01 in a separate Windows job because the current K01 native boundary explicitly requires `NATIVE_WINDOWS_VERIFIED`. A Linux host failure cannot be relabeled as a K01 semantic failure or PASS; Windows build, fixed-point and stage receipts remain non-compensatory.

The first Windows CI receipt passed native execution, fixed point and 40 later stages but exposed stale Stage0 source hashes after the Native UI/Frontier merge (`40/41`). The five changed module hashes are now rebound in `selfhost/rcl-source-selfhost-stage0.rcl`, and a regular test executes the Stage0 verifier so this provenance drift can no longer hide outside the default suite.

## 6. K02 independent AI generation closure

The frozen K02 contract injects three semantic mutations: reactive count transition, authority requirement and reactive input/view binding. Three unique ephemeral read-only generator sessions saw only mutated candidates, observed failures and semantic intent. The deterministic evaluator applied their Schema-bounded exact edits and required canonical byte restoration, rooted Web lowering, structural binding checks and real loopback Node state/observe/rule execution. GitHub run `32865270251`, focused job `97858888422`, replayed all saved candidates for exact source commit `41a5850178161cb26b80129251cd803598aeceda`. This closes K063, K064 and K078 only; K339 cannot reuse application-generation evidence.

## 7. K01 and Android runtime closures

K339 is independently closed by three unique read-only compiler-source repair sessions, three effective opcode-table mutations, exact canonical source restoration and one shared native byte-identical `C0 == C1 == C2` fixed point. GitHub run `32869858927` bound focused job `97873981605` and Windows job `97873981286` for exact source commit `1bdab89cbff822b4d5f4119d009aaab8a07c12f0`; authority root is `ef6f03ca31bd6416f13f2fbab199e692c1111fc5b8db66aef947c463a6e52a43`.

The Android campaign installed the rebuilt K03 APK on `Rcl_Aether_API35_ATD`, exercised the initial state, empty-input guard, five increment/reset rounds and activity recreation by rotation, and measured the full ADB/UIAutomator observation path. A real emulator differential exposed integer results rendering as `1.0`; the Java lowering now preserves `Long` without ternary numeric promotion, and the rebuilt APK renders `1`. Receipt root `9c61a52e883636f28d1a4bfa7c12df710720e7998416e9f8684b81ec38e47ebf` records p95 `2981.554 ms` against the frozen `5000 ms` budget. GitHub run `32871776578`, focused job `97880272426`, then bound three independent Android repair sessions to that emulator receipt; authority root `14bb5c06cc64c1c1952418bd7765da7758353984c3c6c86d4e6bf30615750276` closes K083, K085 and K098 for this bounded slice.

## 8. Server Web/Reactive closure

The Server batch froze its runtime contract before acquisition and ran 20 fresh ephemeral loopback servers. State, observe, governed add/reset transactions and unknown state/rule rejection passed in all 20 rounds. Transaction p95 was `2.782 ms` against `100 ms`; full-replay/startup-proxy p95 was `66.846 ms` against `1000 ms`. Three unique ephemeral read-only sessions independently repaired effective transition, authority and reset mutations, restored canonical bytes, and replayed the same generated HTTP surface. GitHub run `32876898001`, focused job `97896893662`, bound exact source commit `f669460df4e4401e3e2f29b82c0ec35fc295930d`; authority root `5fb9eb94d6575ce9e606fb7c77e30d20f9d531e3cb828d38fc8c7fe028f940d2` closes K124 and K138 only. The `K04-SERVER` filename prefix identifies this evidence batch and does not claim the separate Killer Task K04 2D-game closure.

## 9. K327 compiler closure

K327 is independently closed by three new ephemeral read-only sessions repairing effective `contains`, `sequence_concat` and `sha256_text` builtin-lowering mutations. Each saved proposal restored the exact canonical compiler sources and reproduced compiler artifact SHA-256 `00321946e2b4651b4a05b229e7ec650c76375b394afebbc89fb7e095fc28779b`. The campaign binds the already admitted K01 fixed point only as runtime evidence; it does not inherit K339's AI-generation authority. GitHub run `32880432503` bound focused job `97908294490` and Windows job `97908294012` for exact source commit `42b77ceb71e1d00f686b41096646fd05a61ad6e9`; authority root `72c0ebe2de859e8585fe1f3325d7240896de25eb42055daeec56a78b33934670` closes K327 only.

K321/K322 are independently closed for the bounded frozen recursive-algorithm CLI profile. The profile completed 20/20 native `rclc -> RBC -> rclvm` CLI rounds with one artifact root, one semantic state root, independent GCD/Fibonacci/sum-of-squares Oracle parity, malformed-source rejection and corrupt-RBC rejection. Three isolated read-only sessions repaired three effective algorithm mutations and restored exact canonical bytes. GitHub run `32998424312` bound focused job `98273605189` and Windows job `98273604990` for exact source commit `9c3980a58811fa21c26c2ce9e34f37e05db36356`; authority root is `94dcb025dffd8fe4adb6a8bcc3abae96800b3513a83c93670783c6aad7df8be8`. This closes only K321/K322 for the declared fixed-input native CLI profile; interactive shell authority, arbitrary algorithm generation and unrelated K400 cells remain unclaimed.

## 10. K08-A baseline and K08-B General MLP

`pure-rcl-xor.rcl` owns the frozen dataset, nine parameters, Softsign-01 activation, forward pass, mean half-squared loss, manual gradients, backward propagation, Batch SGD, 512-epoch training loop, prediction and evaluation. Native `rclc` compiled it through `selfhost/compiler.rbc`; native `rclvm` executed 13,965,818 instructions and reached 100% XOR accuracy with loss `0.0157034488743931`. Three replays produced the same semantic state root, while the JS differential oracle had maximum parameter drift `4.44e-15` and did not supply native parameters.

K08-B extends this to a bounded configurable two-Dense-layer General MLP profile. The same RCL Model/Layer/Parameter/Dataset/SGD/Checkpoint semantics train XOR `2-2-1` and Majority-3 `3-3-1`, with shape/data negatives, exact resume, deterministic native replay and differential parity. Three separate read-only Codex sessions repaired activation-gradient, target-binding and parameter-gradient-routing mutations; their saved candidates restore canonical source and passed GitHub-hosted replay in run `32780097954`, focused job `97600047380`. K233 now passes all nine gates for this bounded profile. Tensor, general Autodiff, AdamW and accelerated backends are not implied. See `docs/K08_RCL_NATIVE_AI_CAMPAIGN_v0.1.md`.

## 11. Browser performance contract chronology

Commit `955e6cef527f74a926538d5f8d2b93404add245b` froze the numeric browser budgets before the new acquisition. The first acquisition met every numeric budget but failed the UI-root precondition because the checked-in Counter evidence was stale relative to the device-adaptation IR fields. Revision 2 corrected only that identity precondition to the freshly regenerated canonical root and did not change either numeric threshold. The post-revision real Chrome acquisition passed all checks at `0.884 ms` per three-event sequence against the `1.5 ms` limit and `1037.344 ms` host-process elapsed time against the `5000 ms` limit. This closes only the declared local performance gate; the roughly `49.1×` plain-DOM slowdown remains an observed donor advantage rather than a parity claim.
