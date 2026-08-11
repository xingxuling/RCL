# RBC 1.3 / DOMAIN_CALL Native Promotion Evidence Ledger v0.1

Date: 2026-08-08 (Asia/Shanghai)
Repository: `xingxuling/RCL`
Branch: `research/rbc13-domain-call-salvage-v0.1`
PR: [#39](https://github.com/xingxuling/RCL/pull/39)
Starting head audited: `a7f06b39d5b0aec74c7f2c9d9edd598e09ec32dc`

Historical-snapshot notice: this ledger preserves the earlier native-promotion round, including its native-only Universal Stress blocker. The current A3/A10/A12 closure is generated in `docs/RBC13_FINAL_BLOCKER_CLOSURE_EVIDENCE_LEDGER_v0.1.md`; formal A10 remains `NEGATIVE_RESULT`.

## 1. Target ruling

The four declared operations have **VERIFIED** operation- and candidate-host-bounded Native Promotion evidence. The result is not canonical RBC 1.3 activation. The RBC 1.3 candidate remains **CANDIDATE**, and the Universal Stress probe remains **BLOCKED** until performance and AI-generation gates have evidence.

The governing architecture remains:

```text
source extraction
→ operation differential
→ native-candidate organ
→ experimental RBC 1.3 / DOMAIN_CALL opcode 45
→ stable Domain Value ABI
→ external organ registry
→ VM materialized from current native/rclvm.c
→ native-process differential
→ native semantic state root
→ replay + negative controls
→ Native Promotion
→ separate canonical admission
```

## 2. Audited baseline

- Working tree was isolated at the current PR branch; the old `agent/advanced-runtime-rcl` branch and its artifacts were not used.
- `origin/main` at audit time: `883b265420645b9ee112f0839c794bd76de50bd6`.
- Package: `@taowind/rcl-reality-forge@0.94.0-alpha.1`.
- Canonical language remains RBC 1.1 with feature version 1.2. Canonical `src/bytecode.mjs` does not emit opcode 45, and canonical `native/rclvm.c` is not patched with the experimental Domain Organ path.
- `VERSION-CONTRACT.json`, `COMPONENT-VERSIONS.json`, canonical bytecode feature version, selfhost compiler, and formal release version were not changed.
- UI work: **N/A**; this task has no user interface surface.

## 3. Multi-civilization review record

| Review seat | Ruling applied |
|---|---|
| Founder Twin | Keep the target to four reference-backed operations; no wholesale 18-operation native rewrite. |
| 柳清莲 Gate | High-impact language activation stays outside this PR; `canonicalAdmission=false` remains enforced. |
| 洞哥 Grounding | Every Native receipt binds to current-source materialization, host root, bytecode root, and native state root. |
| 产品文明 | The reusable product primitive is a governed Native Organ slot with a stable value ABI, not a domain-function catalog. |
| UX / 设计文明 | N/A; no UI or user-flow claim is made. |
| 数学 / 形式方法文明 | G1–G12 are conjunctive, not averaged; semantic-root parity and Number boundary tests are explicit. |
| 工程文明 | Windows MSVC discovery/environment loading was added; unsupported compiler discovery stays fail-closed. |
| 代码文明 | Typed value ownership, clone/free symmetry, registry identity, tier checks, and semantic errors are preserved. |
| 测试文明 | Focused, native, semantic-root, metabolism, Universal Stress, full-suite, and selfhost paths were exercised. |
| 安全文明 | Depth/item/text/finite-number limits, duplicate fields, unsupported VM values, tier gates, and no-default-candidate execution are retained. |
| 发布文明 | README’s existing version-contract declaration was aligned without changing version authority; CI remains separately classified. |
| Integration Court | A (candidate architecture Native Promotion) is verified for the declared corpus; B (canonical language admission) is not decided here. |
| Evidence Ledger | This document and the generated promotion/probe reports preserve the roots and failure log below. |

## 4. Impacted modules

- Native compiler resolution: `src/native-c-compiler.mjs`.
- Candidate runtime and current-source binding: `src/rbc13-domain-native-runtime.mjs`.
- Four-operation corpus and semantic error normalization: `src/rbc13-domain-operation-differential.mjs`, `src/rbc13-domain-call-salvage.mjs`, `src/rbc13-domain-bytecode-candidate.mjs`.
- Native ABI and admitted organs: `native/rcl_domain_value.*`, `native/rcl_domain_organ.*`, `native/rcl_domain_admitted_organs.c`, `native/rcl_domain_vm_value_bridge.inc`.
- Promotion gates/report: `src/rbc13-domain-native-promotion.mjs` and `tests/rbc13-domain-native-promotion.test.mjs`.
- Universal Stress candidate probe: `src/rbc13-domain-universal-stress-probe.mjs`, `scripts/run-rbc13-domain-universal-stress-probe.mjs`, and its test.
- Release-document contract only: `README.md`.

## 5. Acceptance gates

Each operation report contains exactly these 12 non-compensatory gates; final `verified` is `G1 && ... && G12`:

1. `G1_operationScopedDifferential`
2. `G2_experimentalRbc13BytesDeterministic`
3. `G3_currentNativeSourceMaterialized`
4. `G4_candidateNativeHostBuilt`
5. `G5_positiveSemanticEquivalence`
6. `G6_negativeSemanticEquivalence`
7. `G7_nativeReplayDeterministic`
8. `G8_nativeSemanticStateRootEmittedAndVerified`
9. `G9_semanticRootParity`
10. `G10_allEvidenceRootsRecorded`
11. `G11_noCaseSilentlySkipped`
12. `G12_nativePromotionEvidenceTier`

G3 records both current VM source roots (`native/rclvm.c` and `native/rclvm.h`) and the materialized candidate VM root. G8 requires a native-emitted `stateRootAlgorithm` and `stateRoot`; JavaScript does not manufacture the native root.

## 6. Native Promotion result

Final generated suite: `output/rbc13-domain-native-promotion/native-promotion-final-2026-08-08.json`
Suite status: `native-verified`
Suite root: `8c310a507fe666d8e0832585456b47124eadc8b07207e1caed49aa7518fd677d`
Host root: `7cf26f927d3bd40cb7d99ce7841867a140e44ec1a517e1a68b94bb612bfb7a1d`
Shared implementation root: `75dfc09964e86a5ac74d1cea04fbbe895200b66fc571f250ef8bfa169c6a4547`
Materialized VM root: `f82d9370248cf73c1657242c93fe94fd9573c3615bb470202c9158b882440357`

| Operation | Cases | Native replays | Negative controls | Report root | Native differential root | Implementation root |
|---|---:|---:|---:|---|---|---|
| `core.echo` | 7/7 | 3 | 1 | `6316aa2c0eea70cd1a67b3c4a635b0c4211dbc5b123c2f1d18729bcf5b7db7d6` | `ec8afef5d0983874b5568f8c8aa5cbdab7ecde5b21c74aea1d508e2ca170371a` | `2c06fd7d9a85bf0a6e2f95bfce088cc0af902f34b0c6a8ffa25219b85d0518ca` |
| `quantity.make` | 6/6 | 3 | 1 | `67a5ac1c33716ac67d2a32e786a9bb911cc974761ad8cb17a161c9ea03fd55c0` | `de793c34b8705edcf52c88cc2a144fbb139aa506e24895f4d2693c1fe588450d` | `1d9e50c1375c97452f8744a4919f550b0ea9a8c8a4f314ad565074467e1935dc` |
| `quantitative.measure` | 5/5 | 3 | 1 | `c07dbdd95535e33cc251d057b0dec7541690f3dee167eb09c2ca35856a4364d0` | `93d7aab8269d51b221f1bef9cefc21a7d663fa0564c8245a705ef7eedfd57ac5` | `4995283d5335b7c524e877920b24893254ada3238496a5112f691125ee7cad1f` |
| `knowledge.claim` | 4/4 | 3 | 1 | `0f229af60c0410a112c59b8e9e91183138e9a37aa61a88ae58df8b539660cbe4` | `560dd86a18116e69f4cb46956018e42c1116fac3000a7da1c53b69929ea86f5f` | `6e13f789c025a00b2de89aefadf3afc456fb2be3f8264f90981812dc7b8e04fd` |

Corpus additions include Truth, dynamic dispatch, invalid dispatch/arity, non-finite and malformed Quantity parameters, uncertainty type mismatch, evidence/calibrated-by/source/scope/status/dependencies/formed-at-root fields, and the declared error contracts.

## 7. Command evidence matrix

| Command | Exit | Result | Duration | Artifact root / failure log |
|---|---:|---|---:|---|
| `npm run build:native` | 0 | VERIFIED | 0.83 s | Source SHA `a805a058e30a222cd3f8299c9b497950c77ee3d181e4ec54c01454a8b1f68d22`; checked Windows manifest had no problems. |
| `node --test` focused RBC13 + ABI + root + metabolism + stress set | 0 | 71 PASS, 1 SKIP, 0 FAIL | 39.679 s | Suite root above; the skip is the explicit no-compiler blocking branch. |
| `node scripts/run-rbc13-domain-native-promotion.mjs ...final...json` | 0 | VERIFIED | 14.778 s | Suite root above; all four report roots above. |
| `npm run verify:rbc13-domain-stress-probe` | 0 | BLOCKED candidate cell | 0.817 s | Probe root `3e87ae82037a2b2b6bf8f800cf810cb544951f1c166f9428b147e827bd37f63d`; `specialCaseAudit=PASS`, `universalGrowthEligible=false`. |
| `npm run verify:version-contract` | 0 | VERIFIED | 0.834 s | Canonical package/contract/component/downstream checks pass; no version authority changed. |
| `npm run verify:native-boundary` | 0 | VERIFIED | 1.653 s | Native `rclvm.exe` SHA `f2d38852d5f3173f3208c8ba42747e02ba02a0482dc4b9bcb021f2a5aef22517`; 1.1 smoke/root parity pass. |
| `npm run verify:selfhost-fixedpoint` | 0 | 9 PASS | 149.884 s | JS/native fixed point and selfhost ABI pass; command emitted no single root. |
| `npm run verify:selfhost-examples` | 0 | VERIFIED, 16 eligible, 0 failures | 1.806 s | Example parity report; unsupported examples remain explicitly classified. |
| `npm run verify:selfhost-stage40` | 0 | VERIFIED, 18/18 checks | 0.936 s | Stage40 target source root `71e899db3794f862101f898dbf0549a534db488f4320f30d07585d523a25ce14`. |
| `node scripts/audit-semantic-root-number-corpus.mjs` | 0 | BLOCKED dependency | 0.606 s | 10 cases: 7 parity, 3 mismatch; canonical v1 algorithm was not changed. |
| `npm test` | 1 | 715 PASS, 3 FAIL, 2 SKIP / BLOCKED | 419.274 s | Three unrelated `self-akashic-record-compiler.test.mjs` failures: test requires `versionLedgerCount >= 60`, current scan has 26; no RBC13 failure. |

## 8. Failure → repair → recheck log

- Initial focused run: one native ABI test falsely treated the WorkBuddy `cc` command wrapper as a C compiler and returned no process status. Root cause was tool discovery, not ABI behavior. Added Visual Studio/MSVC resolution and environment loading; native ABI tests then passed.
- First expanded Native Promotion run: exit 2. `core.echo` invalid dispatch/arity details and malformed Quantity parameter handling did not match source semantics; one malformed value reached a native state-root mismatch. Normalized the semantic error details, restored fail-closed Number membrane validation, and reran the expanded suite: exit 0, four reports `native-verified`.
- First version-contract run: exit 1 because the existing README did not match the verifier’s required version/canonical-source strings. README-only declaration alignment made the recheck exit 0; no version contract or language version changed.
- Full-suite residual: the three self-Akashic failures are pre-existing repository self-scan threshold drift, not a promotion failure. They remain open rather than being suppressed.

## 9. Domain Value ABI and registry ruling

**VERIFIED for the declared ABI surface.** The native tests exercise Null/Number/Truth/Text/Sequence/Typed Record transport, typed result preservation, recursive clone/free paths, duplicate-field rejection, unsupported VM-value rejection, finite Number rejection, depth/item/text bounds, tier checks, missing operations, duplicate registration, deterministic dispatch, and semantic error propagation. Registry lifecycle is init/register/resolve/invoke/free; there is no unregister API in the current design, so no unregister claim is made.

The bridge does not expose private VM heap layout. Candidate execution is explicitly admitted at `native-candidate`; the normal registry minimum remains `native-verified`.

## 10. Architecture judgment: A / B / C

| Route | Expression | Native / ABI | Verification + security | Metabolism / AI / Universal Stress |
|---|---|---|---|---|
| A. Dedicated opcode per capability | High per capability, but surface fragments quickly. | Potentially fast; every capability creates a new opcode and ABI. | Strong local control but a large review and attack surface. | Poor reuse; AI must learn many special forms; weak universal primitive signal. |
| B. `DOMAIN_CALL` + external organ registry | One general call grammar with operation-scoped semantics. | Native when the organ owns the typed ABI and process receipt; stable opcode 45 with versioned organ/value contracts. | Strong if identity, tier, argument validation, roots, state root, replay and negative controls are mandatory. | Reuses metabolism → differential → candidate → promotion; regular schemas are AI-friendly; directly measures reusable cross-language primitives. |
| C. Provider Bridge for all extension | Broad expression through delegation. | Usually opaque delegation, not native RCL semantics. | Provider authority and evidence remain useful, but semantic ownership and root parity are weaker. | Good interoperability, weak Native-General and Universal Stress credit; capability can remain an opaque adapter. |

**Architecture ruling: B is the stronger candidate direction, not a canonical admission.** It is not ordinary FFI because the call is governed by RCL operation identity, typed Domain Value ownership, evidence tier, authority boundary, semantic state root, deterministic replay, mutation negative control, and a conjunctive promotion gate. A provider may return a result; a promoted organ must reproduce the declared semantic result and error contract under rooted native execution.

The four Foundation 4R controls remain explicit: explicit variable/uncertainty handling, provider/capability boundary, authorization/evidence, and adaptive invariant/root consistency.

## 11. Capability Metabolism state machine

The current implementation composes existing protocols rather than introducing a parallel promotion system:

```text
source-extracted
→ corpus-forged
→ differential-verified
→ native-candidate
→ native-verified
→ canonical-candidate (future, separate admission)
```

`differential-absorption-runner.mjs` supplies independent adapters, deterministic repeats, negative controls and evidence roots. `domain-operation-organ.mjs` supplies candidate/verified tiers. The RBC13 promotion layer adds the experimental-bytecode, current-source materialization, native-process and semantic-root gates that are specific to this ABI.

## 12. Universal Stress candidate probe

The probe maps the verified chain to `wasm-vm::algorithm` with `coverageMode=native-semantic`:

```text
RCL source/candidate IR
→ RBC 1.3 candidate bytes
→ DOMAIN_CALL opcode 45
→ external native organ
→ independent native process
→ native semantic state root
```

It is intentionally **BLOCKED**: `EXPRESS`, `COMPILE`, `LOWER`, `EXECUTE`, `CORRECT`, `ROBUST`, and `EVIDENCE` are supported by this probe; `PERFORMANCE` and `AI_GENERATE` are `UNVERIFIED`. The generality audit is `PASS`, but no Universal Stress growth credit is granted and no full-language native claim is made.

## 13. Known semantic-root dependency

The current `rcl.semantic-state-root.v1` Number corpus remains incomplete: 7/10 cases parity, 3/10 mismatch (`max-safe-integer`, `max-safe-minus-one`, `large-decimal`). This is recorded as a dependency/blocker for broader numeric promotion. The v1 canonical encoding was not silently changed. The next valid step is a separately versioned canonical Number encoding proposal plus its own differential and migration evidence.

## 14. CI and release boundary

The latest PR runs for commit `e3f1c59db4c565f40caabf62ed17e0604a7f4a08` were:

- `31258043787` — `RCL Authority Contract`, failure before any step (`steps=[]`).
- `31258043777` — `RCL Canonical Verification`, failure before any step (`steps=[]`).

Both are classified `INFRASTRUCTURE_BLOCKED`, not test failures. Local build, native compile, promotion, semantic-root, selfhost, and focused/full test evidence above was run directly in the current Windows environment.

## 15. Final scientific / engineering ruling

- **VERIFIED:** four declared operation organs have Native Promotion evidence bounded to the expanded corpus, current-source candidate VM, current host build, semantic-root receipts, replay, and negative controls.
- **CANDIDATE:** RBC 1.3 / opcode 45 and the Native Organ ABI remain experimental and non-canonical.
- **BLOCKED:** Universal Stress growth credit, full numeric semantic-root coverage, full `npm test`, and GitHub hosted workflows remain open gates.
- **Not changed:** canonical RBC language activation, canonical opcode set, version contracts, component versions, selfhost compiler, and main.
