# RCL Frontier Spell × Spatial Acquisition Package v0.1

**状态**：`PASS / Phase2B hardware-neutral acquisition package + known-control dry run`  
**日期**：2026-08-11  
**基线**：Phase2A Unknown-Law Experiment Specification v0.1

## 0. 目标

Phase2A 已经把 `spell_symbolic_control_protocol` 编译成当前唯一可直接进入既有 `simple_2x2` 分析族的未知规律规格。Phase2B 不采集未知现象数据，而是把它进一步编译为**可交给独立采集器执行的硬件中立 acquisition package**。

```text
Phase2A spec root
→ balanced 2×2 schedule
→ sealed semantic mapping
→ redacted acquisition schedule
→ calibration manifest
→ raw-row schema
→ external observation pipeline dry run
```

## 1. 2×2 设计

两因子：

- `symbol_program`: active / control
- `spatial_context`: active / control

默认每格 24 个观测，共 96 个观测。语义条件被编译成四个 opaque `blindConditionCode`；采集顺序按固定 seed 生成稳定随机序。

Evaluator 可见：

```text
observationId
blindConditionCode
sessionBlock
replicate
acquisitionOrder
```

Evaluator 不可见：

```text
symbolCondition
spatialContext
expectedAnswer
scenarioTruth
```

## 2. Hardware-neutral instrument binding

当前 package 不绑定具体设备，默认：

```text
instrumentBinding.status = UNBOUND
calibrationManifest.status = UNBOUND
unknownAcquisitionArmed = false
```

要求后续绑定：

- 一个预注册 primary calibrated sensor；
- 独立 monotonic timestamp source；
- 温度/环境日志；
- 与 primary sensor 对应的普通通道监测；
- raw export。

没有设备和校准，不允许从 READY package 自动升级为真实 unknown acquisition。

## 3. Raw schema

每条原始观测至少包含：

```text
observationId
timestamp
instrumentId
session
blindConditionCode
response
qualityFlags
```

语义标签禁止进入 raw evaluator input。

## 4. Known-control dry run

本轮使用 Phase1A 已有的 `known_software_interaction_control` 穿过同一 blind external-observation pipeline，仅验证：

- package balance / redaction 正确；
- downstream blind pipeline 可识别已知普通 interaction；
- unknown acquisition 保持 disarmed。

结果：

```text
packageValid = true
blindPipelineOk = true
knownControlDetected = true
unknownAcquisitionArmed = false
manifestRoot = b383cf4b67e6ea6c29777b97ef9cdafb6298e1743434ef6e005fa2a3e9abccb1
sealedConditionRoot = 63957d011592bcaaf8919ead54b41cb1ad5e603fe5244d39a7f20f3c6f09b8c7
dryRunRoot = 77ecf3e52cac6b85040276183a2e7913d87e32f6b5621955219008a32dd983b3
```

## 5. 多文明联邦

- **Founder Twin**：Phase2B 目标不是“试一次魔法”，而是让第一条 unknown study 可以被独立采集器严格执行。
- **柳清莲 Gate**：unknown acquisition 默认 DISARMED；known control 成功不能提升魔法候选。
- **洞哥 Grounding**：96 个 schedule slot、4 格平衡、校准、raw schema、root 都是承重结构。
- **产品文明**：使用者只需 `Bind Instrument → Calibrate → Export Schedule → Import Raw File`。
- **UX / 设计文明**：语义 mapping 与 evaluator schedule 分屏/分权显示。
- **工程文明**：继续复用 Phase1A external-observation pipeline，不创建旁路 scorer。
- **代码文明**：manifest 和 sealed mapping 都 root-bound。
- **测试文明**：balance、determinism、seed divergence、tamper rejection、known control 全覆盖。
- **安全文明**：无人体、无高能、无 destructive actuation；本版本只生成 acquisition data contract。
- **Integration Court**：只有 unknown acquisition 未武装且 evidence flags 全 false 时可 PASS。

## 6. 下一门 Phase2C

下一刀不是直接改 `unknownAcquisitionArmed=true`，而是实现：

```text
Instrument Binding Contract
+ Calibration Receipt
+ Acquisition Exporter
+ Preexisting Raw File Intake
+ Sealed Analysis Contract binding
```

完成后，才具备“拿一个真实低风险传感器/设备跑第一份 unknown candidate raw dataset”的工程入口。

## 7. 边界

```text
externalRealityVerified = false
newNaturalLawVerified = false
magicVerified = false
```
