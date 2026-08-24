# RCL Frontier Sandbox Instrument Surrogate v0.1

**状态**：`CANDIDATE / Phase2D-S sandbox substitute before real instrument`  
**日期**：2026-08-11  
**基线**：RCL Frontier Phase0–2C

## 0. 目标

真实低风险传感器尚未接入时，不让 Phase2C 停住，也不把沙箱伪装成现实仪器。

本模块建立一个明确标记为 surrogate 的“沙箱仪器”，把 Phase2C 的：

```text
Instrument Binding
→ Calibration Receipt
→ 96-slot Raw Acquisition Template
→ Completed Raw Validator
→ External Observation Contract
→ Blind Scorer
→ Reveal
```

整条链继续运行。

它不是现实证据替代品，而是**实验协议和判别能力的代理运行环境**。

## 1. Evidence class

固定：

```text
sandbox_surrogate_only_not_external_measurement
```

并强制：

```text
sandboxAcquisitionEnabled = true
unknownPhysicalAcquisitionArmed = false
externalRealityVerified = false
newNaturalLawVerified = false
magicVerified = false
```

因此“沙箱通过”只能证明协议能区分预先构造的模型世界，不能证明现实存在对应机制。

## 2. 沙箱仪器

Instrument identity：

```text
instrumentId = rcl_sandbox_surrogate_sensor_v0_1
sensorType = rcl_reality_compiler_sandbox_surrogate
unit = normalized_residual
```

`deviceFingerprint` 绑定 `Reality Compiler Sandbox` 输出根与模块版本。

校准使用 deterministic sandbox null reference，而不是伪造物理校准。

## 3. 六个压力世界

```text
pure_null
symbol_main_only
spatial_main_only
additive_without_interaction
shared_session_drift
injected_symbol_spatial_interaction
```

每个世界都使用同一 Phase2B 96-slot blind schedule 和 Phase2C raw schema。

只有最后一个世界在生成模型中含有 `symbol × spatial` 交互项。

验收规则：

- 前五个不得被升级为 interaction；
- 最后一个必须被现有 blind scorer 检出；
- 所有 raw files 必须通过 Phase2C validator；
- scorer 不接收 private semantic mapping；
- 最终三个现实验证 flag 永远保持 false。

## 4. 为什么继续使用沙箱有价值

这一步可以继续验证：

1. Phase2C 仪器绑定和 raw schema 是否能承受不同世界模型；
2. Null、单主效应、加性与 session drift 是否会被误判为 unknown interaction；
3. 注入真正 interaction 时 pipeline 是否有检出能力；
4. 后续换成真实传感器时，统计和证据结构无需重写。

## 5. 不能从沙箱推出什么

不能推出：

- 符号在现实中会改变物理量；
- 阵法/空间结构具有未知物理作用；
- 以太、魔力或魔法真实存在；
- 沙箱世界与现实世界共享候选定律。

沙箱只回答：“**如果某类机制真的存在，我们的实验链能否在受控条件下把它和普通模型区分开。**”

## 6. 下一门

沙箱可以继续承担：

```text
Phase2D-S1: spell × spatial surrogate pressure
Phase2D-S2: formation full-factorial surrogate
Phase2D-S3: aether continuous-field surrogate（待专用 scorer）
```

真正的 Phase2D-R 仍要求：

```text
REAL_PASSIVE_SENSOR_OR_EXTERNAL_SENSOR_EXPORT
```

在此之前，任何 sandbox result 都不能被提升成现实自然规律证据。
