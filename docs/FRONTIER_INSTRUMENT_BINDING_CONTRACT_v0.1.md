# RCL Frontier Instrument Binding Contract v0.1

**状态**：`PASS / Phase2C instrument binding + calibration + acquisition export contract`  
**日期**：2026-08-11  
**基线**：Phase2B Spell × Spatial Acquisition Package v0.1

## 0. 目标

Phase2B 已有硬件中立 acquisition package，但具体仪器、校准、raw file 生命周期仍未绑定。Phase2C 将它编译成可交给真实低风险被动传感器使用的工程合同，同时仍不启动 unknown acquisition。

```text
Phase2B acquisition manifest
+ instrument identity/fingerprint
+ calibration receipt
→ root-bound binding contract
→ redacted schedule export
→ raw acquisition template
→ completed raw-file validator
```

## 1. Instrument Binding

当前只允许：

```text
passiveMeasurementOnly = true
unknownAcquisitionArmed = false
```

绑定字段：

- instrumentId
- sensorType
- unit
- samplingMode
- exportFormat
- deviceFingerprint

没有设备指纹、单位、传感器类型或有效校准时，绑定直接失败。

## 2. Calibration Receipt

校准收据必须：

```text
status = valid
instrumentId
referenceId
measuredAt
method
tolerance > 0
unit
rawCalibrationRoot
```

收据本身 root-bound；改写校准内容会失败。

## 3. Raw acquisition template

Phase2C 自动从 Phase2B 的 96-slot redacted schedule 生成 raw template：

```text
observationId
timestamp
instrumentId
session
blindConditionCode
response
qualityFlags
```

collector 只填 timestamp / response / quality flags；raw row 不包含 symbol / spatial semantic labels。

## 4. Completed raw-file gate

完整数据文件只有满足以下条件才进入下一层：

- 96 个 observation ID 全部存在且不重复；
- blindConditionCode 与原 schedule 一致；
- instrumentId 与 binding 一致；
- timestamp 可解析；
- response 为有限数值；
- 不含 semantic/expected-answer 泄漏；
- calibrationRoot/bindingRoot 匹配；
- raw root 未被篡改。

## 5. Export bundle

Exporter 将以下对象分离写出：

```text
instrument-binding.json
calibration-receipt.json
redacted-schedule.json
raw-acquisition-template.json
sealed-condition-manifest.private.json
```

private semantic manifest 与 collector/evaluator 数据分离。

## 6. 当前验证

Demo passive sensor binding：

```text
bindingStatus = BOUND_CALIBRATED
unknownAcquisitionArmed = false
bindingRoot = 1a15d311fa1d5395f090be1d501c3e68c5ce0fc7982a9967df24519bc8198f34
calibrationRoot = 7d26af79e8d68ae2365233d30bd55387f73d860d1e26f12d09fd7861155811a1
rawTemplateRoot = 770f99265f63c4b5e13b5c0e64513411fefc68ca47eb1e54f3d3a84d8810de86
```

## 7. 多文明联邦

- **Founder Twin**：Phase2C 的成果是“真实设备可绑定”，不是“未知效应可宣称”。
- **柳清莲 Gate**：绑定成功后 unknown acquisition 仍保持 DISARMED。
- **洞哥 Grounding**：设备指纹、校准参考、schedule ID、raw root 是不可跳过的承重柱。
- **产品文明**：流程收敛为 `Bind → Calibrate → Export → Collect → Validate`。
- **UX / 设计文明**：private condition mapping 不与 redacted schedule 放在同一操作界面。
- **工程文明**：raw template 直接继承 Phase2B schedule，不产生第二套 observation IDs。
- **测试文明**：有效绑定、无效校准、96-slot template、completed raw validation、bundle export 全覆盖。
- **安全文明**：Phase2C 只允许 passive measurement；不驱动人体、高能或破坏性 actuator。
- **Integration Court**：只有 calibration valid 且 unknown acquisition 仍 false 才允许 PASS。

## 8. 下一门 Phase2D

Phase2D 需要一个**真实存在的低风险传感器/设备或外部数据导出**来完成 instrument binding；随后先跑 known physical/control acquisition，再决定是否让 unknown candidate 使用同一个 pipeline。

当前阻断不是编译器，而是：

```text
REAL_INSTRUMENT_OR_EXTERNAL_SENSOR_EXPORT_REQUIRED
```

## 9. 边界

```text
externalRealityVerified = false
newNaturalLawVerified = false
magicVerified = false
```
