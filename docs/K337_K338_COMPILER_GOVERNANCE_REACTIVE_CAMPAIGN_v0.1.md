# K337/K338 Compiler Governance + Reactive Campaign v0.1

**Status:** `PASS` for the bounded K337/K338 profile with GitHub-hosted Linux/Windows authority; broader compiler security and the static warrant-validation gap remain open.

## Reality Audit

- Integrated base: `origin/main@b86b0c9c0c601bf9cfbab45d9e95a770840ce8c8`.
- Matrix coordinates: `K337 compiler-runtime::security-sensitive` and `K338 compiler-runtime::reactive`.
- Canonical semantic owner: RCL.
- Execution boundary: checked-in RCL self-host compiler artifact through native `rclc`, then RBC through native `rclvm`.
- Reused semantics: subject warrant, rule needs, condition, transactional alter, preserve, witness and semantic state roots.
- No provider, shell command or auxiliary language owns the tested authority or reactive transaction semantics. Node only orchestrates evidence acquisition.

The positive program performs two RCL-owned compiler transactions. `authorize_candidate` moves the compiler from phase 0 to phase 1 under inspect/stage warrants. Its committed state enables `emit_candidate`, which moves phase 1 to phase 2 under stage/emit warrants. The second transaction's `beforeRoot` must equal the first transaction's `afterRoot`.

## Frozen runtime result

- Contract was frozen before acquisition at `examples/universal-stress/k337-k338-compiler-governance-reactive-runtime-contract.v0.1.json`.
- Runtime receipt root: `9246052b20d56e655e4e7a39deb81360545bdde0913fafbb8abb4b22d00cb462`.
- Contract root: `0d748c6ce705d178f7449835faa2eeb8ef9dbd48acfb7180d47aa454717648da`.
- 20/20 native compile-and-execute rounds passed with one artifact hash and one final state root.
- Final state root: `3798e740d180c52f702bbe6403a848bb368d8f076a7b2da5021f389b9816e6c4`.
- Windows-local p95: compile `83.5467 ms`, execute `70.8424 ms`, combined `145.3796 ms`; frozen budgets are `5000/1000/6000 ms`.
- Missing warrant, broken preserve, invalid request and corrupt RBC controls all failed closed.

The frozen AI contract then ran three separate ephemeral read-only repair sessions for authority capability binding, reactive phase triggering and preserve bounds. All 3/3 restored canonical bytes and replayed the native evaluator; session IDs are `01a03ed9-e426-7df3-8f38-0aabefb27485`, `01a03edd-32cb-7de2-bd04-55c7c5cd629d` and `01a03ede-ec86-7780-86af-518f0a9015c2`. The rooted aggregate receipt is `52694c563d3cd4f49ef0b3daaf9aec294d6da1bc49ef14ce9d8919334d5ee70a`. GitHub run `33000443777` replayed the exact saved receipts in focused job `98280568550` and the native runtime in Windows job `98280568136`; authority root `fd3b8ea7ee48e410e28cd8d2a9411051db03a96551444e51289a342f80af2824` admits `AI_GENERATE` and `EVIDENCE` for K337/K338 only.

## RCL_GAP

`RCL_GAP_K337_SELFHOST_WARRANT_STATIC_VALIDATION` is open. The JS reference compiler rejects a source whose cause subject lacks a needed warrant, but the RCL self-host compiler currently emits RBC for it. The native VM still rejects that artifact with `RCL_AUTHORITY_DENIED` before commit, so the bounded end-to-end profile remains fail-closed. The workaround is not treated as static validation evidence.

Candidate absorption: port the reference compiler's cause-subject warrant validation into the RCL-owned self-host compiler and add differential invalid-source regression coverage. Affected cells include K337 and K339.

The concrete absorption site is `selfhost/compiler-core.rcl`: parsing already retains `program_subjects`, `program_warrants`, each rule's actor and `rule_needs`, but `validate_rules` currently checks only expressions, alters and preserves, and `validate_program` does not pass subjects/warrants into rule validation. The candidate genome therefore needs a general subject lookup plus scope-aware warrant matcher and recursive need validation. It must be developed under a separate compiler-evolution gate because rebuilding `selfhost/compiler.rbc` changes the fixed point and invalidates existing K01/K327 artifact hashes; this campaign does not silently rewrite those authorities.

## Nine-gate court

| Gate | Local status | Evidence boundary |
|---|---|---|
| EXPRESS | PASS | RCL source owns warrants, conditions, transactions, invariants and witnesses. |
| COMPILE | PASS | Native self-host compiler produced byte-identical positive RBC; the disclosed invalid-source static-validation gap remains open. |
| LOWER | PASS | RCL-owned semantics lower to transaction and authority RBC instructions. |
| EXECUTE | PASS | Native Windows `rclvm.exe` executed 20 rooted rounds. |
| CORRECT | PASS | Exact final state, ordered rules, witnesses, authority needs and root continuity matched. |
| ROBUST | PASS | Four frozen controls rejected or remained mutation-free as specified. |
| PERFORMANCE | PASS | Frozen local budgets passed; this is not cross-machine or competitive parity. |
| AI_GENERATE | PASS | 3/3 independent repairs passed and GitHub focused replay bound the exact saved receipts. |
| EVIDENCE | PASS | Rooted local/runtime receipts are bound to successful Linux and Windows jobs for source commit `2fe5bcae851af1a81fa28277c7697451d512035f`. |

All nine non-compensatory gates now pass for this bounded profile. The conditional K400 builder admits K337/K338 without changing the global verdict: `15 PASS / 385 UNTESTED`, `U3`, `INCOMPLETE`; report root is `ba4d5bdf5e8a332c628635c38994bebadd7a21a0349369b95d030282f42552a3`.

## Integration Court

- Founder Twin: kept compiler governance and state-trigger semantics RCL-owned; no provider became the decision owner.
- 柳清莲 Gate: admitted only after independent generation and hosted replay passed, while preserving the static-validation gap as a named limitation.
- 洞哥 Grounding: required real native process execution, exact state/history roots and effective negative controls.
- Product/UX: limited the profile to an observable two-phase compiler transaction rather than claiming a general security product or event system.
- Engineering/code: reused existing general warrant, transaction and self-host paths; introduced no cell-specific VM opcode.
- Test/security: bound missing authority, broken invariant, inactive request and corrupt artifact controls.
- Release: hosted authority is admitted on the candidate branch; main promotion still requires the final evidence commit replay and PR merge.
- Evidence Ledger: source, contract, binaries, per-round roots, performance and RCL gap are rooted in the checked-in receipt.

## License and diff audit

No dependency, donor code, generated third-party source or asset was added. The diff is limited to one RCL stress program, one frozen contract, one local receipt, evidence scripts, focused tests, package entrypoints and this ledger. License surface is unchanged.
