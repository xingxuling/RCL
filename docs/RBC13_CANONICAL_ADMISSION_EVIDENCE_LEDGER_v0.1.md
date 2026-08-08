# RBC 1.3 Canonical Admission Evidence Ledger v0.1

Date: 2026-08-09, Asia/Shanghai. Repository: `C:\Users\User\Documents\RCL\_worktrees\rbc13-domain-call-salvage-v0.1`. Branch: `research/rbc13-domain-call-salvage-v0.1`. Source-audit base: `a2b732cb07150e3e5097ad408105e0bf48fc83d3`. The sealing commit is the commit that adds this ledger and is recorded by the Git handoff.

## Ledger rule

Every row records the claim, status, command, environment, source/input identity, artifact/output roots, counts, blocker, and reproduction path. A local evidence root is not a hosted-CI result. A candidate report is not a canonical activation.

## Evidence rows

| Claim | Status | Command/environment | Input/artifact root | Output root and counts | Blocker |
| --- | --- | --- | --- | --- | --- |
| Number v2 JS/C parity | `VERIFIED` | `npm run verify:rbc13-number-encoding-v2`; Windows x64; MSVC 19.50 | corpus `a7071d47b65ad721ff3098b977fc607106ac96bb0ffb5910c3ce998f44894da7` | report `c8b8f68438fd0c161999f5e9ca17666a3e282a29e5d3dcfce13dc77691f14a9a`; 11,000 per-case ledger rows, 0 mismatch, 11,000 round trips, C nonfinite rejects 3/3 | none for isolated encoding; canonical activation remains out of scope |
| Number v1 preservation | `VERIFIED` | `npm run verify:version-contract`; v1 corpus audit | existing v1 source/root contract | v1 remains active and unchanged; old audit remains 7/10 on its extended sample | v1 decimal mismatch is historical evidence, not a v2 rewrite |
| Native Promotion inventory | `VERIFIED` | fresh `native-promotion-final-2026-08-09.json` | suite `f34b8c31eee2aac3223c31410829fec579b33f02b009cd7cfa538468b7f07b0b` | operation roots `9bd24818b5123d5cda695fab4bf1533044bce61d8c79acbddf8b49f56067a50e`, `f5afbec31df3e7511b49f15c5e63110172a7af64a52a85afcd7944877c89f455`, `30978d9aca37eac37a9ed1dc0733c861268f409e1b5a0b349cfc362a790e28cd`, `d11ecae29bf809dc78e296c3af71f4619c5c4e08c280a1aea6f5c667f4591580` | no new donor promotion in this round |
| Performance evidence | `VERIFIED` | `npm run verify:rbc13-execution-benchmark`; fixed seed, warmup, 7 repetitions | host `51d37188584830c147ebe9d1ff4538add9341ff5606c0d2223fccdf6b1ba067f` | report `014abc49fc58d5d916e254f32fcfb3913acaa4e3232878962cc664901c30cad4`; 1k/10k/100k for all 3 paths; median/p95/variance/RSS/allocation recorded | no network latency or full structured-value matrix claim |
| AI_GENERATE JSON Schema donor | `NEGATIVE_RESULT` | `npm run verify:rbc13-ai-generate`; local Ollama model; no implementation/source/expected output in prompt | prompt `c9165f68465ed1ffa5bbf4730308bd072eefd3660e08c8ecf4293e7407725ebe`; response `9530eadbc61384bbb865a6bb37ea76573102ed23803c5f6cd9702889f4b26295` | report `32d72528b0acba16bc2dfe47a529603f69f6542d818597920fbb85d4d0ce82ef`; extraction `0d311ab94e16be16d8f5162091a8046753900e58807621ffde0fe362e08db462`; corpus `778ba7ba4f44d499994096055ac06617aa132640886c8c44b9d2893eb1b7963c`; 16 cases/10 mutation plans | draft-07 and missing `unit` constraint; 0/1 successful trials |
| AI replay | `NEGATIVE_RESULT` | explicit fixture replay command; same local host | replay response root `9530eadbc61384bbb865a6bb37ea76573102ed23803c5f6cd9702889f4b26295` | replay report `0154c480b805753d48e3bc95dc7f5b14dd92bd5fb8d0856e6609f7a54a8646a5` | preserves the same donor failure; no repair or promotion credit |
| Universal Stress RBC13 cell | `BLOCKED` | `npm run verify:rbc13-domain-stress-probe` | fresh native evidence plus performance/AI reports | root `2ab51068aa3ac6259c22116371babad23d09beb06e3a5e88bac8403ce906f1cd`; special-case audit remains intact; growth eligible false | AI_GENERATE negative; cell cannot receive universal growth credit |
| Selfhost fixed point | `VERIFIED` | `npm run verify:selfhost-fixedpoint`; Windows x64 | current source and selfhost artifacts | 9 tests, 9 passed, 0 failed; 127.2 s | does not prove complete RBC13 self-emission |
| Selfhost examples | `VERIFIED` | `npm run verify:selfhost-examples` | 52 scanned, 16 eligible | 16 eligible, 0 failures | unsupported examples remain explicitly unsupported |
| Selfhost Stage40 | `VERIFIED` | `npm run verify:selfhost-stage40` | stage40 source/artifacts | byte parity and runtime authority evidence verified | dual-needs subset boundary remains |
| Native Windows boundary | `VERIFIED` | `npm run verify:native-boundary` | `native/rclvm.exe` PE artifact | Windows PE and default native smoke run verified | does not prove C compiler availability through PATH |
| Focused RBC13 regression | `VERIFIED` | `node --test --test-concurrency=1 tests/native-semantic-state-root-contract.test.mjs tests/native-semantic-state-root-native.test.mjs tests/native-capability-promotion.test.mjs tests/capability-metabolism.test.mjs tests/differential-absorption-runner.test.mjs tests/rbc13-number-encoding-v2.test.mjs tests/rbc13-canonical-admission-readiness.test.mjs tests/rbc13-domain-universal-stress-probe.test.mjs` | current source | 40 tests, 40 passed, 0 failed, 0 skipped, 1.21 s | none |
| Full legacy regression | `BLOCKED` | `npm test`; current Windows x64 checkout | current source; native pretest artifact verification | 729 tests, 725 passed, 2 failed, 2 skipped, 369.158 s | one stable v0.57 version-ledger count assertion; one intermittent Windows `EPERM rename` in RCLApp CLI (the isolated 3-test RCLApp suite passed) |
| Version contract | `VERIFIED` | `npm run verify:version-contract` | package `0.94.0-alpha.1` and current contracts | canonical semantic root v1; canonical RBC 1.1/feature 1.2 unchanged | no version change authorized |
| Hosted PR checks | `BLOCKED` infrastructure observation | PR #39 check inspection | pre-sealing base; runs `31258071094`, `31258071169` | Authority Contract and Canonical Verification reported failure before steps; `steps=[]` | classify as `INFRASTRUCTURE_BLOCKED`, not local test failure |

## Admission gate ledger

| Gate | Status | Evidence/blocker |
| --- | --- | --- |
| A1 Number canonicality | `VERIFIED` | v2 report/corpus roots |
| A2 Native Promotion inventory | `VERIFIED` | fresh four-operation promotion roots |
| A3 Legacy regression closure | `BLOCKED` | full suite is not closed |
| A4 Positive semantic parity | `VERIFIED` | four-operation native receipts |
| A5 Negative semantic parity | `VERIFIED` | rejection/error receipts |
| A6 Replay determinism | `VERIFIED` | native receipt and focused replay evidence |
| A7 Semantic-root evidence | `VERIFIED` | v1/v2-isolated root reports |
| A8 Authority/evidence preservation | `VERIFIED` | native promotion and current-source binding |
| A9 Performance evidence | `VERIFIED` | benchmark report/host roots |
| A10 AI_GENERATE donor | `NEGATIVE_RESULT` | donor contract failure, 0/1 trials |
| A11 Selfhost/version contract | `VERIFIED` | fixed point, examples, Stage40, version contract |
| A12 Universal Stress admission cell | `BLOCKED` | AI gate negative; growth eligibility false |

Readiness report root: `84fdc9d1f7c5cdb97adc78272b0cc12dbdfab5e2cf81583c05ad8a1eec58227d`. Overall verdict: `BLOCKED`; canonical readiness is false; blocking gates are A3, A10, and A12. The report is an admission input and does not activate a version.

## Multicivilization sequence

The required sequence was recorded as an engineering review chain:

1. Founder Twin — renamed the task from “add RBC13” to “close non-compensable canonical evidence”.
2. 柳清莲 Gate — required explicit human authority and rejected silent canonical/version mutation.
3. 洞哥 Grounding — bound claims to repository facts, roots, and reproducible commands.
4. Product Civilization — kept the smallest runnable evidence loop and preserved release compatibility.
5. UX / Design Civilization — `N/A` for this no-UI research round.
6. Mathematics / Formal Methods Civilization — selected finite binary64 raw-bit encoding, sign-zero policy, and explicit version isolation.
7. Engineering Civilization — used temporary native build directories and fixed-seed protocols.
8. Code Civilization — implemented JS/C encoding, root v2 candidate, migration receipt, benchmark host, and readiness evaluator.
9. Test Civilization — ran 11,000-number parity, focused RBC13, selfhost, native boundary, Universal Stress, and full regression.
10. Security Civilization — preserved fail-closed nonfinite values, warrants, evidence tiers, causal parents, and no implementation leakage to AI.
11. Release Civilization — kept package/version/canonical contracts unchanged and separated local evidence from hosted CI.
12. Integration Court — accepted the proposal as research evidence but returned canonical activation as `BLOCKED`.
13. Evidence Ledger — sealed roots, counts, commands, blockers, and next gates in this document.

The mother algorithm was applied as: rename → locate authority → set boundaries → materialize evidence → re-verify → leave a controlled next growth path.

## Required next gates

1. Close the three existing self-akashic full-suite assertions without lowering their contract or hiding the drift.
2. Run a fresh blinded AI donor trial that satisfies the exact JSON Schema contract and completes differential evidence through Native Promotion.
3. Rebuild the Universal Stress cell with that donor evidence and obtain a true growth-eligible result.
4. Re-run the entire evidence matrix on the final source roots and obtain a separate Integration Court decision.
5. Only then consider a separate canonical admission PR; do not repurpose PR #39 as a release PR.
