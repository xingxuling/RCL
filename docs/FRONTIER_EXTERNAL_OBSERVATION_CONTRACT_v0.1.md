# RCL Frontier External Observation Contract v0.1

**状态**：`READY / Phase1A data-contract plumbing complete / Real external dataset pending`  
**RCL 基线**：v0.94.0-alpha.1 + Frontier Natural Law Lab v0.1 + Symbolic × Geometry Blindtest v0.1  
**日期**：2026-08-11

## 0. 目标裁决

Phase0 已经证明 RCL 能把候选机制压成数学对象、零假设、实验协议和 Prototype IR；Phase0.5 已经证明盲测器能在合成数据中区分 `null / main / additive / interaction`。

Phase1A 不再继续制造 synthetic signal，而是解决真正进入现实证据之前最容易污染研究的那一层：

> **真实数据怎样进入 RCL，同时保持来源、校准、原始数据不可变、条件语义隔离、盲评分与事后揭盲。**

本版本建立 `External Observation Contract`，让之后的传感器、仪器、公开数据集或人工记录都必须先变成可审计、可根绑定的数据对象，才能进入未知自然规律研究链。

## 1. 合同对象

每份观测合同至少包含：

```text
Provenance
- sourceType
- sourceUri
- collector
- acquiredAt
- licenseOrPermission
- acquisitionMethod

Calibration
- status=valid
- referenceId
- measuredAt
- method
- tolerance

Observation Row
- observationId
- timestamp
- instrumentId
- session
- symbolCondition: active/control
- geometryCondition: active/control
- response
- qualityFlags
```

合同生成：

```text
raw payload
→ rawDataRoot
→ immutable sealed contract
→ contractRoot
```

任何原始行、来源或校准内容在 seal 后变化，都会导致 root mismatch。

## 2. 盲化结构

真实合同中允许存在 `active/control` 语义，因为采集端必须知道自己在做什么；但 evaluator 不允许看到。

RCL 会建立独立 `sealedRandomizationManifest`：

```text
active/control semantic labels
→ secret mapping
→ anonymous factor 0/1
```

评分端只得到：

```text
observationId
symbolFactor
geometryFactor
interactionFactor
session
response
```

它看不到 active/control、source metadata、collector、calibration notes、randomization mapping 或 expected answer。完成 scoring 后才允许 reveal。

## 3. 校准与完整性门

以下任一情况直接阻断：

- source type 不支持；
- provenance 缺失；
- 权限/许可证缺失；
- calibration 不是 `valid`；
- 校准参考或时间戳缺失；
- 观测数量不足；
- 2×2 factor cell 任一格少于 8 条；
- observation ID 重复；
- response 非数值；
- rawDataRoot 不匹配；
- declaredRawDataRoot 不匹配；
- contractRoot 不匹配；
- 原始行含有模型 truth/expected-answer 泄漏字段。

## 4. 已建立的软件已知效应控制

为了先验证“现实数据接口”本身，不直接拿未知自然规律当第一个外部正例，本版本加入：

- `known_software_interaction_control`
- `known_software_additive_control`

它们只用于验证：一个已知工程化 interaction 能否经过同一合同/盲化/评分链被识别；单纯 additive effect 是否会被错误升级成交互；篡改 raw row 是否会被 root 拒绝；缺校准是否会被 intake gate 拒绝；scorer 是否真的没有读 sealed randomization manifest。

结果：全部 PASS。

这不是“外部现实新物理证据”；它只是把研究基础设施从 synthetic-only benchmark 推到**可接真实文件的数据合同层**。

## 5. 实际控制结果

```text
positiveInteractionDetected = true
additiveControlRejected = true
tamperRejected = true
missingCalibrationRejected = true
blindScoreManifestIsolation = true
externalRealityVerified = false
```

Control Suite Root：

```text
f1b49de5ea59f6a6253f2aa71520dea4451a18a5d7f39a667c0bc62c3ff5d5fd
```

## 6. 文件入口

新增 JSON file path：

```bash
node examples/frontier-external-observation-contract/run-external-observation-file.mjs <contract.json> [randomizationSeed]
```

文件可以是已 seal 的 `rcl.frontier-external-observation-contract.v0.1`，或包含 provenance / calibration / rows 的原始 JSON，对应函数会先构造合同。

因此下一次拿到真实公开数据、传感器导出或仪器记录时，不需要再修改研究核心，只需要写 adapter 把数据落到这个合同。

## 7. 多文明联邦裁决

- **Founder Twin**：把“开始做现实魔法实验”重命名为“先保证任何现实数据都不能污染盲测与证据链”。
- **柳清莲 Gate**：禁止把来源为软件控制或 synthetic 的数据标成 external natural-law evidence。
- **洞哥 Grounding**：来源、校准、raw root、contract root、factor-cell coverage 是承重条件。
- **产品文明**：用户动作压缩为“导入真实数据合同 → 自动校验 → 盲评分 → 揭盲 → Evidence Ledger”。
- **UX / 设计文明**：先报告 contract invalid / null / candidate residual，不以“魔法成功/失败”做界面主标签。
- **工程文明**：复用 Phase0.5 scorer，不重新实现一套统计裁决。
- **代码文明**：采集语义与 evaluator 分离；sealed manifest 不进入 scoring API。
- **测试文明**：真实文件路径、篡改、缺校准、盲化、positive/additive controls 均需自动测试。
- **安全文明**：该版本不驱动物理装置，只接数据；后续 actuator/provider 另过授权。
- **发布文明**：源码、测试、runner、合同说明、Evidence Ledger 和控制报告一起交付。
- **Integration Court**：只裁决“数据合同与盲测管线 READY”，不裁决新自然规律存在。
- **Evidence Ledger**：`rawDataRoot → contractRoot → preregistrationRoot → redactedDeckRoot → scoreRoot → revealRoot`。

## 8. 下一门：Phase1B

Phase1B 需要的不是更多代码想象，而是**第一份现实来源的数据**。

优先顺序：

```text
A. 已知现实效应 + 真正的外部数据文件
→ 验证采集/导入/校准/盲测整条链

B. 公开科学数据集
→ 测试 provenance、holdout 和复现

C. 低风险传感器数据
→ 建立真实 acquisition adapter

D. 未知自然规律候选
→ 使用完全相同的合同与盲测器
```

成功门不是“出现异常”，而是：

```text
外部数据可追溯
+ 校准有效
+ 原始数据不可变
+ 盲测无泄漏
+ 预注册判据固定
+ 独立重复
```

**当前结论**：RCL 已经从“能做未知规律合成实验”推进到“可以接收现实观测文件”的 Phase1A 数据接口层；尚无任何新自然规律获得现实验证。
