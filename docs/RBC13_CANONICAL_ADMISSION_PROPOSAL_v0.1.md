# RBC 1.3 Canonical Admission Proposal v0.1

Committee material — proposal only, not a canonical activation.

Current proposal verdict: `BLOCKED`. `canonicalReady = false`. Canonical language, formal version contracts, and the released native VM ABI remain unchanged.

Current strict-growth ruling: `Level 2 VERIFIED` is the global maximum supported by the closed evidence surface; `Level 3 CANDIDATE/BLOCKED` remains gated. Compatibility ACL2, C/WASM parity, or a bounded native candidate does not grant canonical admission or formal A10 promotion.

## 1. Motivation

RBC 1.3 / `DOMAIN_CALL` is intended to let RCL absorb bounded external semantics into evidence-gated native organs while preserving typed values, authority, receipts, deterministic replay, and a stable bytecode boundary. The admission question is not whether one experimental VM can execute four operations; it is whether the feature has enough non-compensable evidence to become language infrastructure.

## 2. Exact feature definition

The candidate feature is an experimental `DOMAIN_CALL` instruction (opcode 45) that resolves a declared operation through a native-organ registry, crosses the Domain Value ABI, invokes an admitted organ, and returns a typed result plus evidence-bearing receipt. Operation identity, input/output kinds, causal parent, authority needs, evidence tier, and replay roots are part of the candidate boundary.

## 3. Opcode 45 semantics

Opcode 45 is currently candidate/experimental. It is not silently reclassified as a canonical bytecode feature. Unknown operation, missing organ, unsupported value, invalid evidence, bad causal parent, authority failure, and organ error must fail closed with structured diagnostics; no partial state mutation is admitted.

## 4. Domain Value ABI

The membrane admits explicit scalar and structured value kinds, performs typed conversion, rejects unsupported kinds, and preserves semantic roots and receipts. It is versioned as the existing candidate ABI v1. Number v2 is a separate preparation dependency and is not substituted into old receipts.

## 5. Native Organ Registry

The registry binds operation names to organ implementations, required evidence tier, supported input/output kinds, and authority/effect metadata. The four-operation Native Promotion inventory remains verified for the current-source materialization, but that inventory is not proof that every future donor can be promoted.

## 6. Evidence-tier model

The candidate distinguishes diagnostic/development evidence, differential candidate evidence, native candidate evidence, and native verified promotion. A lower tier cannot unlock a higher tier by score accumulation. A `VERIFIED` local receipt is not a release or canonical admission by itself.

## 7. Capability Metabolism relationship

The intended metabolism is extraction → capability spec → corpus → independent differential absorption → candidate organ → promotion attempt. The current Compatibility Surface tested the same blinded donor protocol against three local models: the medium tier reached ACL2 with 0 human repair, while tiny/strong produced invalid or incomplete donors; formal A10 remains `NEGATIVE_RESULT` because Native Candidate/Native Process/Semantic Root/Replay/Promotion are not closed.

## 8. Failure semantics

All uncertainty and mismatched semantics remain explicit. Rejected values, missing providers, invalid warrants, failed controls, stale roots, non-finite numbers, and unsupported domains do not produce a best-effort native result. The existing authority/evidence boundary stays above the organ call.

## 9. Number encoding dependency

`rcl.canonical-number.v2` is a finite binary64 raw-bit encoding with explicit `-0` normalization and non-finite rejection. Its 11,000-case JS/C corpus is `VERIFIED`. It remains a version-isolated candidate; `rcl.semantic-state-root.v1` and historical receipts remain valid under v1.

## 10. Backward compatibility

The current canonical semantic root, RBC 1.1/1.2 behavior, version contract, and existing native artifacts were not rewritten. Any future adoption must use an explicit versioned root and migration receipt. No decoder may guess whether a v1 root is a v2 root.

## 11. Self-host compatibility

Current selfhost fixed point is 9/9, the eligible example parity suite is 17/17 with zero failures, and Stage40 is verified. This proves the existing selfhost boundaries. It does not yet prove that the full RBC 1.3 candidate is emitted and executed by the complete selfhost compiler.

## 12. Security and authority implications

The organ cannot acquire authority merely by being generated, fast, or locally executable. Policy → decision/evidence → action remains the governing order. Authority, warrants, causal parents, negative controls, and replay evidence must survive the membrane. The AI experiment never received implementation source or repository paths.

## 13. 4R implications

The candidate keeps reality input, reasoning/selection, realization, and review distinct: source and corpus are evidence; the compiler and registry select bounded capability; the organ realizes only an authorized call; receipts and courts review the result. No development artifact becomes a freeze or publication authority.

## 14. Performance evidence

The three-path benchmark is `VERIFIED` as a measurement: primitive, native organ, and provider-shaped paths ran at 1k/10k/100k with warmup, seven repetitions, median, p95, variance, RSS proxy, and allocation proxy. It supports a tier cost model, not a universal Native Organ speed claim and not a network-provider comparison.

## 15. AI_GENERATE evidence

The earlier single-donor JSON Schema trial remains historical `NEGATIVE_RESULT`: its response used draft-07 and omitted the required `unit` constraint. The current same-protocol Compatibility Surface is also `NEGATIVE_RESULT`: medium reached ACL2, tiny/strong were ACL0, human repairs were 0, and no model reached Native Promotion. No native promotion credit is granted.

## 16. Universal Stress evidence

The earlier native-only Universal Stress snapshot remains historical and blocked. The current A12 cell records verified JS/C/WASM parity, ABI negative controls, and replay for one bounded graph workload, but this experimental result does not grant universal maturity or canonical language; formal A10 remains negative.

## 17. Alternatives considered

The committee considered specialized opcodes, `DOMAIN_CALL` plus Native Organ, and provider-only extension. The current evidence favors a possible hybrid tier model but does not establish canonical superiority. A separate canonical PR is preferable to mixing research, implementation, admission, and release responsibilities in PR #39.

## 18. Rejected architecture: hard-wired 18 builtins

Adding one builtin/opcode for each domain would multiply compiler, VM, version, authority, and replay surface. It would make externally discovered capability difficult to metabolize and would turn an evolving organ inventory into permanent language syntax. It is rejected for this feature family.

## 19. Provider Bridge comparison

Providers remain appropriate for network, model, and heavyweight external work. They pay serialization/allocation and delivery costs but preserve an explicit boundary. Native organs are appropriate only when semantics are bounded, evidence-backed, replayable, and authority-safe. Neither path is a universal replacement for the other.

## 20. Canonical admission risks

Open risks are legacy/full-suite drift, incomplete Universal Stress closure, AI donor insufficiency, future-runtime conformance, full structured-value performance coverage, and the distinction between experimental opcode and canonical ABI. A green focused suite cannot compensate for any of these.

## 21. Migration plan

Close formal A10, rerun the complete matrix, and publish an explicit v2 root/number migration receipt and cross-runtime conformance package. Only after an independent Integration Court review should a separate canonical PR propose formal version changes.

## 22. Rollback plan

Keep v1 decoding and receipts available. Disable candidate opcode 45 and registry entries behind the experimental boundary, retain evidence reports as research artifacts, and reject v2 roots unless the v2 implementation is explicitly selected. No rollback may mutate historical v1 roots.

## 23. Exact version changes required

None are authorized in this preparation round. A future admission would require an explicit change set for the canonical RBC feature version, native ABI/version metadata, semantic-root binding, compatibility/migration receipts, and release documentation. `VERSION-CONTRACT.json`, `COMPONENT-VERSIONS.json`, package release version, and canonical README claims remain unchanged now.

## 24. Admission checklist

| Gate | Current status |
| --- | --- |
| A1 Number canonicality | `VERIFIED` |
| A2 Native Promotion inventory | `VERIFIED` |
| A3 Legacy regression closure | `VERIFIED` after version-ledger test-contract closure; final admission still depends on the full-suite result |
| A4 Positive semantic parity | `VERIFIED` |
| A5 Negative semantic parity | `VERIFIED` |
| A6 Replay determinism | `VERIFIED` |
| A7 Semantic-root evidence | `VERIFIED` |
| A8 Authority/evidence boundary | `VERIFIED` |
| A9 Performance evidence | `VERIFIED` |
| A10 AI_GENERATE donor | `NEGATIVE_RESULT` |
| A11 Selfhost/version contract | `VERIFIED` |
| A12 Universal Stress admission cell | `VERIFIED` as an experimental C/WASM cross-body graph cell; canonical admission remains separate |

Canonical readiness is the conjunction of all twelve gates. A3 and A12 have current experimental closure evidence; formal A10 remains a blocker, and the final readiness ledger must bind the final full-suite result before any admission recommendation.

## 25. Integration Court verdict

`BLOCKED`: accept this document and its evidence as a research/admission proposal; do not accept canonical activation, formal version changes, or release promotion. The Court must be reconvened after the three blocking gates close, with a separate admission PR and a final human freeze decision.
