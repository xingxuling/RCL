# RBC 1.3 Admission Closure Evidence Ledger v0.1

Date: 2026-08-09 (Asia/Shanghai)  
Repository: `xingxuling/RCL`  
Checkout: `C:\Users\User\Documents\RCL\_worktrees\rbc13-domain-call-salvage-v0.1`  
Branch: `research/rbc13-domain-call-salvage-v0.1`  
Source commit: `cc962af64138a8426f78c38a503f19ffd1024b4c`  
PR: #39  
Final verdict: `BLOCKED`  
Canonical admission: `false`  
Readiness report root: `ac10f7592e9f183f89e7ffbb5779f86eb3260aae31c9c3ba4a30d7cee3597b2e`

## Evidence rule

Each claim records `claim_id`, gate, status, commit, environment, command, input root, artifact root, result root, receipt root, test count/pass/fail/skip, blocker, and reproduction command. A local root is not a hosted-CI result. A candidate is not a canonical activation. No canonical branch, version contract, RBC 1.1/1.2 contract, or native VM source was changed.

Environment for this closure: Windows x64, Node `v24.15.0`, package `0.94.0-alpha.1`, native VM `rcl-native-vm/0.6.0-alpha.1`, semantic root `rcl.semantic-state-root.v1`, MSVC `19.50` where the benchmark used a compiler.

## Multicivilization sequence

1. Founder Twin: renamed the task from “add RBC 1.3” to “close non-compensable admission evidence”.
2. 柳清莲 Gate: retained human authority over canonical/version mutation and rejected silent activation.
3. 洞哥 Grounding: bound every claim to repository facts, roots, commands, and explicit boundaries.
4. Product Civilization: kept the smallest runnable evidence loop and protected release compatibility.
5. Math/Formal Civilization: preserved binary64 raw-bit semantics, negative-zero policy, and version isolation.
6. Engineering Civilization: used the current native runtime, fixed protocols, replay checks, and fail-closed adapters.
7. Code Civilization: added A3 closure, A10 threshold, A12 graph-cell probe, and readiness wiring.
8. Test Civilization: ran focused RBC13, RBC 1.1/1.2, Universal Stress, selfhost, and full regression suites.
9. Security Civilization: preserved warrants, evidence tiers, causal parents, negative controls, and no AI implementation leakage.
10. Release Civilization: kept package/version/canonical contracts unchanged and separated local evidence from hosted CI.
11. Integration Court: accepted the research evidence but returned canonical admission `BLOCKED`.
12. Evidence Ledger: sealed the roots, counts, blockers, reproduction commands, and next gates in this document.

## Claim ledger

| Claim ID | Gate | Status | Commit / environment | Command | Input root | Artifact root | Result root | Receipt root | Tests | Blocked reason | Reproduction |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `A1.number-v2` | A1 | `VERIFIED` | `cc962af`; Windows x64 / Node 24.15.0 | `npm run verify:rbc13-number-encoding-v2` | v2 corpus `a7071d47b65ad721ff3098b977fc607106ac96bb0ffb5910c3ce998f44894da7` | `output/rbc13-number-encoding-v2/corpus-report.json` | `99b3021a186f9c6f77761ed652f68efec7415220e5262f79adc956a7719a163f` | `a7071d47b65ad721ff3098b977fc607106ac96bb0ffb5910c3ce998f44894da7` | 11,000 cases; 0 mismatch; 11,000 round trips; 3/3 nonfinite rejects | none; no canonical activation | same command |
| `A2.native-promotion-inventory` | A2 | `VERIFIED` | `cc962af`; native VM `0.6.0-alpha.1` | `node scripts/run-rbc13-domain-native-promotion.mjs output/rbc13-domain-native-promotion/native-promotion-final-2026-08-09.json` | current-source candidate VM; native artifact `f2d38852d5f3173f3208c8ba42747e02ba02a0482dc4b9bcb021f2a5aef22517` | four-operation promotion report | `ac5a2fda3ad883b1ee9e560b499d002904a3d05ef87e71222de65793e8e4fd31` | `745e95d74581a0de1a28a3c6bf88a856667272ff42e20cd577731febb5551470`; `17a7e634cbe4cd0142ef0d6f8d36cf17585ecc939a8dc181fe1edf9940b56674`; `8411adc36c7320d85e48ba1b00fd6c07f85f2c576a62a527981066228cedb364`; `d2301eea3fa7833b66b65f85b1cacabfd4b0697cd7ef79b3a57c1545a910b0a0` | 4 operations; positive/negative/replay/semantic-root gates pass | none; candidate evidence is not canonical promotion | same command |
| `A3.legacy-receipt-closure` | A3 | `VERIFIED` as receipt closure; admission remains blocked by full suite | `cc962af`; Windows x64 / native VM `0.6.0-alpha.1` | `npm run verify:rbc13-legacy-evidence-closure` | inventory `c33453601f567a33a11413b7d958f864ebca7f1445b65cae16b5f70a04003a8a` | six current source/bytecode/result/artifact roots in the record table below | `c40d999c5f5e8d4c837d28a40f7dfd15cf9c209bc17fe6d95a129c450ee4d13c` | six receipt roots in the record table below | expected 6; verified 6; missing 0; duplicate 0; stale 0; altered 0; replay mismatch 0 | full `npm test` is not `VERIFIED` | same command |
| `A4.positive-semantic-equivalence` | A4 | `VERIFIED` | `cc962af`; current-source native candidate | native promotion suite | four operation inputs | four operation reports | `ac5a2fda3ad883b1ee9e560b499d002904a3d05ef87e71222de65793e8e4fd31` | `745e95d74581a0de1a28a3c6bf88a856667272ff42e20cd577731febb5551470`; `17a7e634cbe4cd0142ef0d6f8d36cf17585ecc939a8dc181fe1edf9940b56674`; `8411adc36c7320d85e48ba1b00fd6c07f85f2c576a62a527981066228cedb364`; `d2301eea3fa7833b66b65f85b1cacabfd4b0697cd7ef79b3a57c1545a910b0a0` | focused evidence pass | none | promotion command |
| `A5.negative-semantic-equivalence` | A5 | `VERIFIED` | `cc962af`; current-source native candidate | native promotion suite | invalid/error cases | rejection receipts | `ac5a2fda3ad883b1ee9e560b499d002904a3d05ef87e71222de65793e8e4fd31` | `745e95d74581a0de1a28a3c6bf88a856667272ff42e20cd577731febb5551470`; `17a7e634cbe4cd0142ef0d6f8d36cf17585ecc939a8dc181fe1edf9940b56674`; `8411adc36c7320d85e48ba1b00fd6c07f85f2c576a62a527981066228cedb364`; `d2301eea3fa7833b66b65f85b1cacabfd4b0697cd7ef79b3a57c1545a910b0a0` | focused negative controls pass | none | promotion command |
| `A6.deterministic-replay` | A6 | `VERIFIED` | `cc962af`; native VM `0.6.0-alpha.1` | native promotion and RBC 1.1/1.2 suites | fixed inputs and replay inputs | native receipts | `ac5a2fda3ad883b1ee9e560b499d002904a3d05ef87e71222de65793e8e4fd31` | replay roots `745e95d74581a0de1a28a3c6bf88a856667272ff42e20cd577731febb5551470`; `17a7e634cbe4cd0142ef0d6f8d36cf17585ecc939a8dc181fe1edf9940b56674`; `8411adc36c7320d85e48ba1b00fd6c07f85f2c576a62a527981066228cedb364`; `d2301eea3fa7833b66b65f85b1cacabfd4b0697cd7ef79b3a57c1545a910b0a0` | 34 focused: 33 pass, 1 skip; 96 RBC 1.1/1.2: 96 pass | native-promotion test skip is infrastructure-only | focused commands |
| `A7.semantic-root-evidence` | A7 | `VERIFIED` | `cc962af`; root algorithm v1 | native semantic-root tests and promotion suite | current source and typed values | native state-root receipts | four operation roots | replay roots equal state roots | focused semantic-root assertions pass | none | focused command |
| `A8.authority-boundary` | A8 | `VERIFIED` | `cc962af`; canonical branch remains `main` | `npm run verify:version-contract` and native promotion | `VERSION-CONTRACT.json`, `COMPONENT-VERSIONS.json`, `DOWNSTREAM-CONSUMERS.json` | contract verification | `ef9fe2d8dcfa0b9dff5863b079a36f4dbc871714e388e3244ce2c29c91ad208b` | native suite `ac5a2fda3ad883b1ee9e560b499d002904a3d05ef87e71222de65793e8e4fd31` | version contract 0 errors; authority/evidence gates pass | no canonical mutation authorized | same commands |
| `A9.execution-benchmark` | A9 | `VERIFIED` | `cc962af`; Windows x64 / MSVC 19.50 | `npm run verify:rbc13-execution-benchmark` | fixed seed `RBC13-PERFORMANCE-2026-08-09`; input `9007199254740991` | three declared in-process paths | `01fe49cfd65f264713442cc0fca4ebbe8fe22d45475b8b6cbcf1f61601757078` | host `3953f65c79a7e7145b41ed1c71d595cbe2fc5b05dac07dd37bd045395a3b0fea` | 3 paths x 3 iteration sizes x 7 repetitions; variance/RSS/allocation recorded | no network-latency or competitive-ranking claim | same command |
| `A10.ai-assimilation-threshold` | A10 | `NEGATIVE_RESULT` | `cc962af`; Windows x64 / Ollama `http://localhost:11435/api/generate`; 0 human interventions | `npm run verify:rbc13-ai-assimilation-threshold` | prompt `c9165f68465ed1ffa5bbf4730308bd072eefd3660e08c8ecf4293e7407725ebe` | donor spec `bc05b4a9df5f3bdf71af6c4cc9660dba90c4ce61c2a69683f56b65a3666630a5` | `a53e9fd74f733bc5d8d996f5ae780fc6b297c8116a399fd729bf97231e756f38` | `eda11a442ade6910e327f2358e24bc65dc199754f512ba99a17c1bd4824a0e8c`; `07a8e9f9fc400fe52e9cf1771938912473b76a972c1f69dfc3aef236aba1a717`; `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` | 3 tiers; max L2; min L0; contract/differential/native/promotion not all closed | no tier reached L4; no native promotion credit | same command |
| `A11.selfhost-version` | A11 | `VERIFIED` | `cc962af`; Windows x64 / native VM `0.6.0-alpha.1` | fixedpoint, examples, Stage40, version-contract commands | current source and checked-in selfhost artifacts | fixedpoint `20e0ac0c0cbcc049d14b56c565574f70d023ce47baebb491aae83da956ebc84d`; examples `3164b0a50b01ab604a666ef144f92dcf56dfe72839c1be2bd4fee62a55adf3a9`; Stage40 `b46f2d15612621cf06c4916d3e0f9bb817ab5ee73ec506717b561eb540d7223a`; contract `ef9fe2d8dcfa0b9dff5863b079a36f4dbc871714e388e3244ce2c29c91ad208b` | corresponding roots | 9/9 fixedpoint; 17 eligible examples / 0 failures; 18/18 Stage40 checks; contract 0 errors | whole-language runtime selfhosting remains false by contract | same commands |
| `A12.graph-growth-cell` | A12 | `BLOCKED` | `cc962af`; Windows x64 / native VM `0.6.0-alpha.1`; wasm adapter absent | `npm run verify:rbc13-universal-growth-cell` | graph source `7a7351fb1f1b36d43920db871aa21934577544d5cc33cbe56072e1b506a555eb` | native bytecode `0c941975f962ec5c0854a993a620b52975e38788bcf7424877ab31c6ac1c233e` | native state root `e54e26024c5f3e15f9dc5b9040a41525726bf61c1a8dda7703df37424ee4c898` | no universal-growth receipt; report `0c51d6f19e2d735969b5d37fde159d21dd0cadc40a6435653b92b9e265c90ecd` | native result/replay pass; 1 A12 test pass | blocker `wasm-vm-runtime-and-abi-unsupported`: no wasm adapter/binary, opcode bridge, memory/value ABI, error ABI, semantic-root bridge, replay harness, or host-boundary proof | same command |

### A3 stable case records

| Stable ID | RBC | Source root | Bytecode root | Result root | Artifact root | Receipt root | Replay root | Runtime |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `rbc11.stage5.encoder` | 1.1 | `fd9b4e1db21e91221eb89e11002650b5be1b1e36f416f7982ee474f00615011f` | `2d99bbd95d7e67077db9694d156faf9c43484e58bff54c3381a3a32857071aea` | `57d29cd1e7990002f842657d9862e1d3a04135671985ab6bf3f895371058301d` | `3c3fe05fffd1b9e257bf6c754655afe2a84c08e91f8090d8a06c87edbc7f3e0b` | `46a3766c66bf884781e2a98d345221d855069a61a2d6159b7337e9dbe9aa4681` | `0436623c59d258862cdab71a2f33c6010b4c40edec4470293e30a95043b41a8d` | `rcl-native-vm/0.6.0-alpha.1` |
| `rbc12.foundation.batch-a` | 1.2 | `1c6d79d81ce5f6af02e73dde5021418df5061a73daabeadb72bfad2f143e88f8` | `3705305f0548d2945a313609c2f27da0c24166f31ee9659dc5ba7b0e57403209` | `ea668d63168483bf6bc8e68a2c0166338df5912f355f2ae0edce5fc1d30d91ad` | `876229232725a97849e77c786e88f8d31916a9554e19144f90af21b82ad38fac` | `9355423dc517b0e2450e39a77d1e6d0eca021abbdf2cc671dbb0862ea3274f59` | `0ec9121a4c0367e51de068b06d294d4ba2bec4f4a8f5e76ba5c0d253a2288b3d` | `rcl-native-vm/0.6.0-alpha.1` |
| `rbc12.foundation.meta-batch-b` | 1.2 | `a26349e4cfe61007dfdfff228a8a1f8047addda1029e062a2f65f5346aa8fdff` | `e5ed4c14852ed7d531e36eed46779533d9c7905deecb34364e19edaff8d3048f` | `5563283f81d4e407af65129034a5cb80d3a2d9a19082ca9de0f15e3cc7467df3` | `84417b44cdc8d6d3212bd6835b5ccbef153a7da355577c684549a16cdc5b34b7` | `9ec977f5bda920ba80d96c7b5950e808e37afef9c9d0160f033afd5a3fe09492` | `1d22b8565c04538abe431b5d644d3776d0e0322cf546e61ce23afc6859741318` | `rcl-native-vm/0.6.0-alpha.1` |
| `rbc12.foundation.batch-c` | 1.2 | `8837e82b8e2a40dd1100044d6c8145cb7f4e5cd79b069944fcbb0dccfa808df3` | `b9d3885ffdbcbaaf6f51fa229656bc235a1b6217f555e2f86f4983d2da3f14fa` | `2740eb8b9fb8ff18d3aeae50a68996ab837e10601fbd38bb8beac741ae6a04ed` | `f020922854707300dc8bc4569105b765e6a3fb70ddc15619830fe2543b2e070c` | `e6da356a9fd341bd2e16331bc122341d177fb4ad15e258add4903cd33fd9613f` | `706b39f9731158570d2fe21a1f80cd532fa11308b04c3a6f1ad7052e279335e0` | `rcl-native-vm/0.6.0-alpha.1` |
| `rbc12.foundation.batch-d` | 1.2 | `850f89424395477a24c9cd33be1c420110240b5f6db30c5df9a0047a2f50c4b7` | `46c8480d2232d73312f8072a450d028f6544142a24654787f1f4c54e752f70db` | `60e94e8d86e2413c4b61fd0d1441315a895e8144b0b56e2a3e5c38e97d116b31` | `e7a5f467a8e11bc04bd57c6977030694924414ded56a38766abe2330f3650921` | `aa1c8d9ed6a44dd5828910ec21a4bdc4e2e702c9692c1c594753618d52c03263` | `4877fe73b3ef8a7f209ce08843e043c590c6747c9a7ab783b9df0232854041e0` | `rcl-native-vm/0.6.0-alpha.1` |
| `rbc12.foundation.batch-e` | 1.2 | `ddd309904ac311c9878ef622238dec862e245d3ec1f7906c2ff3022960eeeb83` | `804225ba2601885ea8f96a1e97d35dfccf396f56027d18926d1067c36ed58290` | `f501994fd6c4654f092985381654aa8f0c81e66681cbe15c38fbbade7ba87496` | `ee8ed7f9a68ca1543af75dae58af3a375cc994388e13934e11a3e17de52c0fd0` | `2529518cbd9586ee2273e3ada59b23655c72a798b53673fb1987a9d90dea6727` | `51fcf086a3f4d575a36e6d8be9e0f7f2e5c99052d75fd689d97efb6345bec235` | `rcl-native-vm/0.6.0-alpha.1` |

The A3 verifier used the authoritative inventory, ran each stable case from current source, and checked source-root, bytecode-root, result-root, artifact-root, runtime receipt, replay root, runtime version, and RBC version. It detected no missing, duplicate, stale, or altered receipt.

## A10 threshold detail

The fixed chain was `Donor Spec → Extraction → Signature → Contract → Positive/Negative Corpus → Candidate → Differential → Mutant Detection → Repair Attempt → Native Candidate → Promotion Attempt`. No implementation code, hidden tests, expected outputs, or human repair were supplied or applied.

| Tier | Model / model version | Level | Contract | Candidate | Differential | Mutant detection | Repair | Native candidate | Promotion |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Small | `aetherseed-tinyllama-runtime:latest` / `ca5641fd566c` / 637 MB | L0 | fail: exact required fields and `unit` | semantic-absorbed | blocked: no independent JSON Schema validator adapter | detected | not attempted; 0 human | blocked | blocked |
| Medium | `aetherseed-trained-smoke:latest` / `5cd5d497f398` / 5.2 GB | L2 | pass | semantic-absorbed; no equivalence cases | blocked: no independent JSON Schema validator adapter | detected | not attempted; 0 human | blocked | blocked |
| Strong | `qwen3.5:latest` / `6488c96fa5fa` / 6.6 GB | L0 | fail: no JSON object | unavailable | blocked | unavailable | not attempted; 0 human | blocked | blocked |

Level definitions: L0 means unavailable/invalid contract; L1 means contract plus extraction/corpus incomplete; L2 means candidate exists but differential is unavailable/failed; L3 means differential exists but native/promotion is incomplete; L4 means independent native candidate and promotion evidence with zero human repair. The result is scoped only to this donor, protocol, and listed local models.

## A12 wasm-vm audit

The graph traversal workload is `experimental-native-semantic`, not canonical native-semantic. Native execution produced `reachable=true`, `unreachable=false`, deterministic replay, semantic-root parity, and `noProviderFallback=true`. Universal growth eligibility remains false because the wasm-vm side is not present. The exact blocker class is `wasm-vm-runtime-and-abi-unsupported`; compile, bytecode/opcode-45 bridge, memory/value ABI, error ABI, semantic-root bridge, replay harness, and host-boundary proof are all missing. No silent provider fallback was accepted.

## Regression ledger

| Claim ID | Status | Commit | Command | Result / roots | Tests | Blocker |
| --- | --- | --- | --- | --- | --- | --- |
| `RBC13.focused` | `VERIFIED` | `cc962af` | focused RBC13 command in A1-A12 report | summary root `abebbc61b115b85db4be2d92004f31d43484f17baeff4936a88ebe9cfeeaa3e0` | 34 total; 33 pass; 0 fail; 1 skip | one native-promotion infrastructure skip |
| `RBC11-RBC12.focused` | `VERIFIED` | `cc962af` | six language/Foundation bridge test files | summary root `cd5fd632ff6075c2a290d548bb9cd267b409274b21102f1644ebb56291050b4a` | 96 total; 96 pass; 0 fail; 0 skip | none |
| `Universal Stress suite` | `VERIFIED` as regression suite | `cc962af` | seven Universal Stress/A12 test files | summary root `4b5f324c9b74d522bcf75681589de9c5ee23091a22e381ef8c47608171ed04a6`; existing four-op candidate root `83d125ccc171878914d24ed195565de7346023a1349c47bfa01c6f4326718026` | 31 total; 31 pass; 0 fail; 0 skip | candidate growth admission still false because A10 is negative |
| `npm-test.full` | `BLOCKED` | `cc962af` | `npm test` | summary root `797d259e20801db4b00d5ab57e3a77d951484e84f172ec5c9259168a06e3a5f9` | 733 total; 730 pass; 1 fail; 2 skip | existing `v0.57 scans RCL repository as finite self-record`: actual `versionLedgerCount=34`, assertion requires `>=60`; no RBC13 test failed |
| `native-boundary` | `VERIFIED` | `cc962af` | `npm run verify:native-boundary` | native PE `f2d38852d5f3173f3208c8ba42747e02ba02a0482dc4b9bcb021f2a5aef22517`; boundary root `58c1e7d0e26b35756cee78e6af14a27786ef76fe129ce021ef3c3c78b6404590` | smoke pass | compiler PATH absence is recorded, not treated as native artifact failure |

## Admission result

| Gate | Status | Evidence | Blocking reason |
| --- | --- | --- | --- |
| A1 | `VERIFIED` | Number v2 report/corpus | none |
| A2 | `VERIFIED` | four-operation native promotion | none |
| A3 | `BLOCKED` | A3 closure `VERIFIED`, full suite not closed | self-Akashic version-ledger assertion |
| A4 | `VERIFIED` | positive semantic differentials | none |
| A5 | `VERIFIED` | negative/error differentials | none |
| A6 | `VERIFIED` | replay roots | none |
| A7 | `VERIFIED` | semantic-root parity | none |
| A8 | `VERIFIED` | authority/version contract | none |
| A9 | `VERIFIED` | execution benchmark | none |
| A10 | `NEGATIVE_RESULT` | three-tier threshold, max L2 | no tier reached L4 |
| A11 | `VERIFIED` | fixedpoint/examples/Stage40/version contract | none |
| A12 | `BLOCKED` | graph cell native pass, wasm-vm audit blocked | wasm-vm runtime and ABI unsupported |

Integration Court therefore returns `BLOCKED`; no canonical changes are authorized and no separate `feat/rbc13-canonical-admission` PR is proposed in this sprint. Existing PR #39 remains a research/evidence PR only.

## Hosted checks and next step

Base hosted runs `31281979844` (Authority Contract) and `31281979851` (Canonical Verification) failed with `steps=[]`, so they are classified as `INFRASTRUCTURE_BLOCKED`, not as local test failures. A post-push check must be inspected separately.

RCL autonomous growth assessment: `Level 3/5` — bounded selfhosted compiler closure plus a reproducible native graph candidate can be generated and evaluated from existing primitives, but general universal growth, independent AI donor promotion, and autonomous canonical admission are not established. Level 5 is not claimed.

Required next gates:

1. Resolve the existing self-Akashic version-ledger contract/test drift without weakening the intended contract.
2. Supply a new blinded JSON Schema donor trial that reaches independent differential evidence and Native Promotion, still with zero human repair.
3. Add the missing wasm-vm runtime/ABI evidence or choose a workload supported by an inspectable wasm adapter; do not count opaque delegation.
4. Re-run A1-A12 from one final evidence root and obtain a new Integration Court decision.
5. Only if all 12 gates are `VERIFIED`, open a separate `feat/rbc13-canonical-admission` PR; never activate RBC 1.3 from PR #39.
