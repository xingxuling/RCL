# RCL Frontier Research Stack｜Work 模式实验交接文档

**交接日期**：2026-08-11  
**仓库**：`xingxuling/RCL`  
**目标分支**：合并后使用 `main`；合并前候选分支为 `feat/frontier-unknown-knowledge-evidence-loop-v0.1`  
**任务性质**：执行实验、回归、压力测试与证据封存；不是继续扩写概念叙事。

---

## 0. Work 模式接手后的第一原则

请把本项目当成**未知自然规律研究基础设施的工程/方法学验证**，不要把 sandbox 输出解释为现实物理证明。

全程保持：

```text
externalRealityVerified = false
newNaturalLawVerified = false
magicVerified = false
```

除非未来出现符合 Evidence Court 明确证据门的独立现实数据，并经过后续单独裁决；当前任务绝不修改这三个 flag。

禁止为了得到 PASS 而：

- 放宽阈值；
- 删除负例；
- 改预注册 lag / phase / distance scale；
- 将失败场景移出 suite；
- 把 timeout / CI 未启动写成 PASS；
- 把 sandbox surrogate 当真实仪器；
- 用叙事解释替代失败裁决。

负结果是有效结果。

---

# 1. 当前系统状态

Frontier 主链目前已实现：

```text
Unknown Knowledge Compiler
→ Candidate Evidence Ledger
→ Experiment Specification
→ Design Grammar
→ Scorer Router
→ Sandbox Surrogate
→ External Observation Contract
→ Preregistered Analysis Contract
→ Evidence Court / Candidate Tournament
```

首发三条候选：

| Candidate | Design Family | 当前实现状态 |
|---|---|---|
| `spell_symbolic_control_protocol` | `simple_2x2` | 实验规格、96-slot acquisition、instrument binding、sandbox surrogate 已实现 |
| `formation_spatial_constraint_array` | `full_factorial_2powk` | generic factorial scorer + `2^3` surrogate 已实现 |
| `aether_substrate_information_medium` | `continuous_field` | continuous-field scorer + time-series surrogate 已实现 |

Evidence Court 证据梯级：

```text
R0 SPECIFIED
R1 SANDBOX_PROTOCOL_SURVIVED
R2 EXTERNAL_SINGLE_ACQUISITION_CANDIDATE
R3 EXTERNAL_REPRODUCED_CANDIDATE
R4 INDEPENDENT_THIRD_PARTY_REPLICATED_CANDIDATE
```

Sandbox PASS 最多进入 R1。

---

# 2. 为什么现在必须由 Work 模式实际执行

最近 GitHub Actions 并非代码测试失败，而是 **job 在任何 step 启动前即被 GitHub 账户 billing / spending-limit 条件拒绝**。

因此最近新增的：

- Sandbox Instrument Surrogate；
- Formation `2^3` full-factorial surrogate；
- Aether continuous-field surrogate；
- Evidence Court；
- Unknown Knowledge → Candidate Evidence Ledger bridge；

都不能因为“测试文件已经写好”就被标记为 PASS。

Work 模式的第一任务就是提供一个真正可执行的 Node 环境，完成 canonical local execution，并封存结果。

---

# 3. 环境基线

记录后再运行：

```bash
node --version
npm --version
git rev-parse HEAD
git status --short
uname -a || ver
```

推荐 Node：仓库 GitHub workflow 使用 **Node 22**。

安装依赖：

```bash
npm ci --ignore-scripts
```

若依赖安装失败，先记录完整错误，不要切换 lockfile 或升级依赖来“救测试”。

---

# 4. Gate A｜新增 Evidence Loop 最小测试

先只跑最新桥接模块：

```bash
node --test tests/frontier-candidate-evidence-ledger.test.mjs
```

预期存在 6 个逻辑检查：

1. promoted unknown candidate 只进入 experiment-spec queue，不自动升 R1；
2. canonical promoted candidate 可以进入 Court，但 compiler score 不替代 evidence rung；
3. compiler rejected candidate 即使手工绑定 lane 也不能进 Court；
4. append-only event 改变 ledger root 且仍可验证；
5. 篡改 root-bound entry 必须失败；
6. 三个 evidence flags 保持 false。

任何失败：停止声明这一层 PASS，保存 failure trace。

---

# 5. Gate B｜三条 sandbox 主研究线

先确认测试文件：

```bash
ls tests/frontier-*.test.mjs
```

然后分别执行，不要一开始就用超大 aggregate command：

```bash
node --test tests/frontier-sandbox-instrument-surrogate.test.mjs
node --test tests/frontier-generic-factorial-scorer.test.mjs
node --test tests/frontier-formation-factorial-sandbox-surrogate.test.mjs
node --test tests/frontier-continuous-field-scorer.test.mjs
node --test tests/frontier-aether-continuous-field-sandbox-surrogate.test.mjs
node --test tests/frontier-evidence-court-candidate-tournament.test.mjs
node --test tests/frontier-candidate-evidence-ledger.test.mjs
```

如果某个文件名在仓库中不同，以 `ls tests/frontier-*.test.mjs` 的真实结果为准，不要假造路径。

### Spell 目标

Pressure worlds：

```text
pure_null
symbol_main_only
spatial_main_only
additive_without_interaction
shared_session_drift
injected_symbol_spatial_interaction
```

验收：前五个不能被当作目标 interaction；最后一个必须检出。

### Formation 目标

`2^3`：

```text
boundary_mask × layout_topology × orientation
8 cells × 16 replicates = 128 observations（默认）
```

Pressure worlds：

```text
pure_null
orientation_boundary_main_only
layout_topology_main_only
additive_all_main
topology_orientation_interaction
topology_boundary_interaction
dual_target_interaction
```

验收：Null / ordinary mains / additive 不得伪造 interaction；目标 topology interactions 要正确分离。

### Aether 目标

默认：

```text
3 distance levels
× 4 phase levels
× 2 shield levels
= 24 sessions
```

每 session 默认 192 samples。

预注册 kernel：

```text
K(d, φ, s) = exp(-d / λ) × cos(φ) × T(s)
λ = 4
target lag = 3 samples
shield transmission = 0.35
```

Pressure worlds：

```text
pure_null
shared_environment_only
ordinary_constant_leakage
wrong_lag_kernel
distance_only_coupling
shield_only_coupling
injected_preregistered_kernel
```

验收：只有最后一个应通过完整 kernel gate。

特别检查输出：

```text
lagSearchUsed = false
phaseSearchUsed = false
distanceScaleSearchUsed = false
```

---

# 6. Gate C｜完整 Frontier test batch

单套稳定后再运行：

```bash
node --test tests/frontier-*.test.mjs
```

若 aggregate 因资源/时间失败：

- 记录为 aggregate timeout/failure；
- 保留逐文件执行结果；
- 不将 aggregate 写为 PASS。

可选再运行全仓：

```bash
npm test
```

全仓失败时要区分：

```text
Frontier regression
vs
unrelated legacy repository failure
vs
environment/toolchain failure
```

---

# 7. Gate D｜运行四个关键 demo

至少运行：

```bash
node examples/frontier-formation-factorial-sandbox-surrogate.mjs
node examples/frontier-aether-continuous-field-sandbox-surrogate.mjs
node examples/frontier-evidence-court-candidate-tournament.mjs
node examples/frontier-unknown-knowledge-evidence-loop.mjs
```

如果存在 Spell sandbox demo，也一并运行。

保存原始 JSON 输出，不只截图。

---

# 8. Gate E｜多随机种子压力实验

Unit test 通过后做真正的实验 campaign。

建议 Work 模式创建：

```text
artifacts/frontier-work-experiment-2026-08-11/
```

写一个**只负责调用现有 API、不修改 scorer 参数**的 runner。

## E1 Spell multi-seed

至少：

```text
100 seeds × 6 worlds
```

记录：

- false positive count；
- false negative count；
- model winner distribution；
- raw validator failure count；
- pipeline failure count。

## E2 Formation multi-seed

至少：

```text
100 seeds × 7 worlds
```

记录每个 target term：

```text
layout_topology
layout_topology:orientation
boundary_mask:layout_topology
```

的：

- TP / TN / FP / FN；
- effect distribution；
- standardized effect distribution；
- route mismatch count。

## E3 Aether multi-seed

至少：

```text
100 seeds × 7 worlds
```

记录：

- detected rate；
- kernel correlation；
- R²；
- kernel beta；
- empirical p；
- wrong-lag false-positive rate；
- constant-leakage false-positive rate；
- shared-environment false-positive rate。

**不得**根据 multi-seed 结果反向调阈值后把同一批数据重新算作预注册成功。

若发现阈值需要调整：当前实验判负/方法学发现；另开新版本和新 preregistration。

---

# 9. Gate F｜Evidence Court 对抗实验

运行 baseline Court 后再人工注入不同 evidence fixtures，验证法律语义。

必须覆盖：

### F1 Sandbox-only

预期：

```text
三个候选最多 R1
truthWinner = null
```

### F2 Protocol failure

人为提供一个失败 sandbox suite。

预期：

```text
REPAIR_PROTOCOL
```

不能写成外部机制被反证。

### F3 Decisive external falsifier

给任一 candidate：

```text
decisiveFalsifier = true
```

预期：

```text
REJECTED_BY_DECISIVE_EXTERNAL_FALSIFIER
researchDisposition = REJECT
```

且工程成熟度不得补偿。

### F4 Single external acquisition

只有当下列同时为 true：

```text
present
independentAcquisition
provenanceValid
calibrationValid
rawRootBound
ordinaryModelsCleared
residualDetected
```

才允许到 R2。

### F5 Replication

```text
directionalReplicationCount >= 2 → R3
thirdPartyReplication = true + replicationCount >= 2 → R4
```

但仍：

```text
newNaturalLawVerified = false
magicVerified = false
```

---

# 10. Gate G｜Unknown Knowledge Compiler → Ledger 实验

运行：

```bash
node examples/frontier-unknown-knowledge-evidence-loop.mjs
```

重点不是默认候选具体谁晋升，而是检查分类语义：

```text
compiler promoted but no experiment spec
→ R0 / COMPILE_EXPERIMENT_SPEC

compiler rejected
→ REVISE_OR_ARCHIVE

canonical lane + compiler promoted + Court judgment
→ may be courtManaged
```

再准备一组新的 synthetic unknown candidates：

- 有明确 falsifier + measurable residue 的候选；
- 高 novelty 但没有 falsifier 的候选；
- unlimited energy / cannot fail 一类 red-flag candidate；
- 一个与现有 `spell_symbolic_control_protocol` lane id 对齐的 candidate。

目标是确认：**候选生成质量与 Evidence Court 证据等级不会被混为同一个数值。**

---

# 11. 必须输出的交付物

Work 模式完成后至少生成：

```text
artifacts/frontier-work-experiment-2026-08-11/
├─ ENVIRONMENT.md
├─ TEST_RESULTS.md
├─ TEST_RESULTS.json
├─ SPELL_MULTI_SEED.json
├─ FORMATION_MULTI_SEED.json
├─ AETHER_MULTI_SEED.json
├─ EVIDENCE_COURT_BASELINE.json
├─ EVIDENCE_COURT_ADVERSARIAL.json
├─ UNKNOWN_KNOWLEDGE_LEDGER_RUN.json
├─ FAILURE_LEDGER.md
└─ FINAL_EXPERIMENT_REPORT.md
```

`FINAL_EXPERIMENT_REPORT.md` 必须明确区分：

```text
PASS
FAIL
NEGATIVE_RESULT
BLOCKED
NOT_RUN
INFRASTRUCTURE_FAILURE
```

不得使用模糊的“基本通过”。

---

# 12. Work 模式回传时我最想看到的东西

按这个顺序给结果：

1. **Commit SHA / Node / OS**；
2. **每个 Frontier suite 的 tests passed / failed**；
3. **Spell 600-run multi-seed summary**；
4. **Formation 700-run multi-seed summary**；
5. **Aether 700-run multi-seed summary**；
6. **Evidence Court baseline 和 adversarial verdicts**；
7. **Unknown Knowledge → Ledger 分类结果**；
8. 所有 negative result / unexpected false positive；
9. 是否需要新 preregistration，而不是偷偷改旧阈值；
10. 最终裁决：哪些模块从 `CANDIDATE` 升为 `PASS`，哪些保持 `CANDIDATE/FAIL/BLOCKED`。

---

# 13. 当前允许得出的最高结论

如果所有 sandbox / Court / ledger 实验全部成功，最高只能写：

> RCL Frontier Research Stack 在当前实现和测试环境中通过了未知候选编译、三类实验设计、沙箱判别、证据账本和非补偿 Evidence Court 的工程/方法学验证。

仍然**不能**写：

> 已证明 Spell / Formation / Aether 在现实世界成立。

真实自然规律证据仍需未来的外部仪器、独立 acquisition、重复与第三方复现。
