# RCL Frontier Aether Continuous-Field Sandbox Surrogate v0.1

**状态**：`CANDIDATE / Phase2D-S3 continuous-field scorer + surrogate implemented`  
**日期**：2026-08-11  
**基线**：RCL Frontier Phase0–2D-S2

## 0. 目标

Phase2A 已经把 `aether_substrate_information_medium` 编译为 continuous-field 实验规格，但此前 Design Grammar 明确将 continuous-field 标记为 BLOCKED，因为没有专用 scorer。

本轮关闭这一结构性缺口，并继续遵守同一边界：沙箱只做代理协议压力，不替代现实仪器或现实自然规律证据。

研究问题被压缩为：

> 在预先冻结 lag、distance scale、phase model 与 shield attenuation 后，source / receiver 独立时间序列中是否存在与 `distance × phase × shield` 预注册 transfer kernel 一致的残余相关结构，并且这种结构不能由 shared environment、普通恒定泄漏、错误 lag、单纯 distance 或单纯 shield 模型解释？

## 1. Continuous-Field Payload

新增：

`src/frontier-continuous-field-scorer.mjs`

每个 session 至少包含：

```text
sessionId
distance
clockPhaseRad
shieldCondition
sampleRateHz
source[]
receiver[]
environment[]
qualityFlags[]
```

强制覆盖：

- 至少 12 个 session；
- 至少 3 个 distance level；
- 至少 4 个 phase level；
- shielded / unshielded 两类都存在；
- 每个 source / receiver / environment 序列等长且至少 64 samples；
- payload root 不可被 scoring 前改写。

当前 surrogate 默认使用：

```text
3 distance levels
× 4 phase levels
× 2 shield levels
= 24 sessions
```

每个 session 默认 192 samples。

## 2. 预注册 transfer kernel

当前 v0.1 scorer 只允许一个固定 kernel family：

```text
K(d, φ, shield)
= exp(-d / λ)
  × cos(φ)
  × shieldTransmission(shield)
```

默认：

```text
λ = 4
shieldTransmission = 0.35
targetLagSamples = 3
```

这些值在 scoring 前进入 payload analysis plan。

明确禁止：

```text
lag search
phase search
distance-scale search
```

也就是说 scorer 不能看到数据以后再四处找“最漂亮”的 lag 或 kernel 参数。

## 3. Session-level response

每个 session：

1. source / receiver 分别对 environment channel 做预注册线性 residualization；
2. 只在固定 `targetLagSamples` 计算 cross-correlation；
3. correlation 经 Fisher-Z 转换；
4. 得到一个 session-level residual response；
5. 用预注册 kernel predictor 解释跨 session 的 Fisher-Z 结构。

随后计算：

```text
kernel beta
kernel correlation
R²
residual SD
permutation p
```

默认 detection gate：

```text
|kernel correlation| >= 0.60
R² >= 0.35
|kernel beta| >= 0.20
empirical permutation p <= 0.02
```

这些阈值不是物理真实性概率，只是当前 surrogate 判别协议的预注册门。

## 4. 七个 surrogate pressure worlds

`src/frontier-aether-continuous-field-sandbox-surrogate.mjs`

建立：

```text
pure_null
shared_environment_only
ordinary_constant_leakage
wrong_lag_kernel
distance_only_coupling
shield_only_coupling
injected_preregistered_kernel
```

验收目标：

- pure null 不得检出；
- shared environment 在 residualization 后不得检出；
- 普通恒定泄漏不得因为存在 source→receiver coupling 就被误判为目标 kernel；
- 与目标 kernel 相同但位于错误 lag 的信号不得通过；
- 只有 distance 或只有 shield 的 coupling 不得被升级成完整 distance×phase×shield kernel；
- 只有 `injected_preregistered_kernel` 应通过目标 detection gate。

## 5. Scorer Router v0.3

`frontier-design-grammar-router.mjs` 新增：

```text
continuous_field
→ preregistered_continuous_field_kernel_v0_1
```

因此 Design Grammar 当前支持：

```text
simple_2x2
full_factorial_2powk
continuous_field
```

`repeated_measures` 仍保持 BLOCKED。

没有 fallback。

## 6. Evidence boundary

本轮固定：

```text
sandbox surrogate only
externalRealityVerified = false
newNaturalLawVerified = false
magicVerified = false
```

即使七个 surrogate worlds 全部分类正确，也只能说明：

> 给定预构造的时间序列生成机制，当前 RCL continuous-field pipeline 能否在预注册参数下区分目标 transfer kernel 与若干普通替代模型。

不能推出：

- 现实存在以太；
- 现实存在未知信息介质；
- 魔法存在；
- 沙箱 kernel 与现实自然规律相同。

## 7. 当前工程裁决

代码、router、tests、demo 已进入 candidate branch。

仓库 canonical GitHub Actions 目前仍受账户 billing / spending-limit 问题影响，不能把未启动的 CI 写成 PASS。因此合并前/合并时裁决仍应为：

`CANDIDATE / implementation complete / canonical CI unavailable`

## 8. 下一门

若在可执行 Node 环境中通过 tests，Aether 历史状态可由：

```text
BLOCKED_PENDING_CONTINUOUS_FIELD_SCORER
```

升级为：

```text
READY_CONTINUOUS_FIELD_SCORER_SANDBOX_VALIDATED
REAL_INSTRUMENT_PENDING
```

之后再建立真正的 independent-device time-series acquisition package、双时钟 calibration receipt、RF/network leakage audit 与 external raw export intake。
