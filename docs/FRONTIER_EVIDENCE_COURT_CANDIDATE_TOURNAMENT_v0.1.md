# RCL Frontier Evidence Court / Candidate Tournament v0.1

**状态**：`CANDIDATE / implementation complete / canonical CI unavailable`  
**日期**：2026-08-11  
**基线**：RCL Frontier Phase0–2D-S3

## 0. 目标

Frontier Research Stack 已经有三条首发未知规律候选：

- `spell_symbolic_control_protocol`
- `formation_spatial_constraint_array`
- `aether_substrate_information_medium`

此前它们主要沿各自实验设计独立推进。Evidence Court v0.1 把三条研究线第一次放进同一个**非补偿性证据法庭**：

```text
candidate root
+ experiment spec root
+ sandbox protocol outcome
+ external evidence (optional)
+ decisive falsifier (optional)
→ evidence judgment
→ candidate tournament
```

目标不是给三条候选做“玄学排行榜”，而是让它们接受同一套证据义务、淘汰义务与晋升门。

## 1. Evidence Rungs

当前证据梯级：

```text
R0 SPECIFIED
R1 SANDBOX_PROTOCOL_SURVIVED
R2 EXTERNAL_SINGLE_ACQUISITION_CANDIDATE
R3 EXTERNAL_REPRODUCED_CANDIDATE
R4 INDEPENDENT_THIRD_PARTY_REPLICATED_CANDIDATE
```

这是**序数门**，不是可相加分数。

例如：

- 100 次漂亮的沙箱 PASS 不能补偿 0 次现实采集；
- 工程完成度高不能补偿决定性反证；
- 一次现实正结果不能补偿缺失的独立复现；
- 不允许“总分高所以某个失败门可以忽略”。

## 2. Sandbox 的法律地位

Sandbox 只证明：

> 给定一个预构造的生成机制，当前分析协议是否有能力把目标机制与 Null、普通主效应、泄漏、漂移、错误 lag、加性结构等替代模型区分开。

Sandbox **不证明候选机制在现实存在**。

因此 sandbox suite 失败时，Evidence Court 的裁决是：

```text
BLOCKED_PROTOCOL_DISCRIMINABILITY_FAILURE
researchDisposition = REPAIR_PROTOCOL
```

而不是“候选自然规律被反证”。

真正可以直接淘汰候选的，是预注册现实实验中的**决定性 external falsifier**。

## 3. 三条候选如何进入 Court

### Spell × Spatial

Design family：`simple_2x2`

输入 suite：`runSandboxSurrogatePressureSuite()`

Court 要求：

- 全部 raw validation 通过；
- 全部 blind pipeline 通过；
- 六个沙箱世界全部分类正确。

工程阶段当前最高：已经有 acquisition package、instrument binding contract、calibration/raw schema 路径，只缺真实设备。

### Formation

Design family：`full_factorial_2powk`

输入 suite：`runFormationFactorialSandboxPressureSuite()`

Court 要求：

- generic full-factorial payload 全部有效；
- 全部 route 到 generic factorial scorer；
- 七个 Formation surrogate worlds 全部分类正确。

### Aether

Design family：`continuous_field`

输入 suite：`runAetherContinuousFieldSandboxPressureSuite()`

Court 要求：

- continuous-field payload 全部有效；
- 全部 route 到 preregistered continuous-field scorer；
- 七个 surrogate worlds 全部分类正确；
- lag / phase / distance-scale adaptive search 全部为 false。

## 4. External Evidence Contract

Court 不允许只传一个“实验成功=true”。现实证据至少需要同时声明：

```text
present
independentAcquisition
provenanceValid
calibrationValid
rawRootBound
ordinaryModelsCleared
residualDetected
```

全部满足才进入 R2。

再要求：

```text
directionalReplicationCount >= 2
```

才进入 R3。

再有真正第三方复现：

```text
thirdPartyReplication = true
```

才进入 R4。

即便进入 R4，Court 仍保持：

```text
externalRealityVerified = false
newNaturalLawVerified = false
magicVerified = false
```

因为“高证据候选”仍不等于自动证明完整自然规律，更不等于证明整个“魔法”概念族。

## 5. Decisive Falsifier

如果 external evidence 明确携带：

```text
decisiveFalsifier = true
```

则直接：

```text
REJECTED_BY_DECISIVE_EXTERNAL_FALSIFIER
researchDisposition = REJECT
```

这个裁决优先于：

- sandbox 表现；
- 工程完成度；
- 研究优先级；
- 过去任何正面叙事。

这就是 Evidence Court 的非补偿性核心。

## 6. Tournament 输出

Court 输出：

- `survivors`
- `rejected`
- `protocolBlocked`
- `evidenceLeaders`
- `engineeringLeaders`
- 每个候选的独立 `judgment`
- Evidence Court root

不同 Design Family 的 raw effect magnitude **不允许直接比较**。例如 Aether 的 kernel correlation 与 Formation 的 factorial effect 不存在合法的“谁数值大谁赢”。Tournament 比的是证据层级与是否通过同级义务。

`engineeringLeaders` 只表示谁更接近真实 acquisition，不是自然规律真实性排名。

## 7. 当前应有的解释

在还没有真实未知候选外部数据时，即使三个 sandbox suite 未来全部正式 PASS，合理 Court 状态也只是：

```text
Spell      → SURVIVES_SANDBOX_ONLY_PENDING_EXTERNAL_EVIDENCE
Formation  → SURVIVES_SANDBOX_ONLY_PENDING_EXTERNAL_EVIDENCE
Aether     → SURVIVES_SANDBOX_ONLY_PENDING_EXTERNAL_EVIDENCE
```

这时：

```text
truthWinner = null
```

也就是说，沙箱只能让候选“活到下一轮”，不能让任何候选称王。

## 8. 当前验证边界

本 PR 包含 Evidence Court 的自动测试，覆盖：

- 三条 sandbox survivor 同级并存；
- protocol failure 不误杀外部机制；
- decisive external falsifier 非补偿性淘汰；
- 单次现实采集只升 R2；
- 两次复现升 R3；
- third-party replication 升 R4；
- Court root 对证据变化敏感。

但仓库 canonical GitHub Actions 当前被 account billing / spending-limit 条件阻止启动，因此本版本只能标为：

`CANDIDATE / tests present / canonical execution unavailable`

不得把未执行测试写成 PASS。

## 9. 下一门

Evidence Court 建立以后，下一步不再是“给每个候选继续加故事”，而是建立：

```text
Candidate Evidence Ledger
→ new result enters
→ Court reruns
→ survivor / reject / hold / replicate
→ research allocation changes
```

随后可以加入更多候选，并让 Unknown Knowledge Compiler 自动把新候选送进 Court，而不是人工决定谁值得保留。
