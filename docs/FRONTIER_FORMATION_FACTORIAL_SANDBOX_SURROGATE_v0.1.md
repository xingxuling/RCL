# RCL Frontier Formation 2^3 Factorial Sandbox Surrogate v0.1

**状态**：`CANDIDATE / Phase2D-S2 generic full-factorial surrogate path implemented`  
**日期**：2026-08-11  
**基线**：RCL Frontier Phase0–2D-S1

## 0. 目标

Phase2A 已把 `formation_spatial_constraint_array` 编译为完整 `2^3` 因子实验规格，但当时的 full-factorial scorer 只接受 NIST 专用 fixture。Phase2D-S2 关闭这个结构性缺口，并在真实仪器尚未接入前继续使用 Reality Compiler Sandbox 做 surrogate pressure。

这一轮不把沙箱结果当现实证据，只回答两个问题：

1. 非 NIST 的任意平衡 `2^k` 数据能否进入统一 factorial scorer；
2. Formation 的三个预注册因素能否在 Null、主效应、加性和交互世界中被正确区分。

## 1. Generic Full-Factorial Payload

新增：

`src/frontier-generic-factorial-scorer.mjs`

通用 payload：

```text
factors[]
rows[]
  observationId
  factors: { factorA: -1/+1, ... }
  nuisance: {...}
  response
provenance
root
```

强制要求：

- `pm1` 编码；
- 完整 `2^k` cell coverage；
- 各 cell 重复数完全平衡；
- response 有限数值；
- payload root 不可被事后修改；
- scorer 使用完整正交结构，不压扁 nuisance 设计。

Factorial estimator：

```text
beta(term) = mean(y * product(x_i in term))
effect(term) = 2 * beta(term)
SS(term) = N * beta(term)^2
```

并以预注册 `targetTerms` 做 thresholded target decision。

## 2. Scorer Router v0.2

`frontier-design-grammar-router.mjs` 现在区分两种 full-factorial payload：

```text
NIST public fixture
→ orthogonal_full_factorial_2powk

Generic full-factorial payload
→ generic_orthogonal_full_factorial_2powk
```

不存在 fallback。NIST reproduction 路径保留，Formation 不再需要伪装成 NIST schema。

## 3. Formation 2^3 Design

因素：

```text
boundary_mask
layout_topology
orientation
```

8 个完整 factorial cells，默认每格 16 个 observation，共 128 条。

Nuisance blocks：

```text
batch
room_session
```

预注册 target terms：

```text
layout_topology
layout_topology:orientation
boundary_mask:layout_topology
```

这与 Phase2A Formation 规格的语义目标一致：先看 topology 主项，再看 topology 与 orientation / boundary mask 的结构性交互。

## 4. 七个沙箱压力世界

```text
pure_null
orientation_boundary_main_only
layout_topology_main_only
additive_all_main
topology_orientation_interaction
topology_boundary_interaction
dual_target_interaction
```

验收语义：

- Null 不得产生 target detection；
- 非 topology 的 ordinary main effects 不得污染 target terms；
- additive main effects 不得被误判为 interaction；
- topology main effect 必须可单独检出；
- 两个预注册 topology interaction 必须能分别检出；
- dual interaction 世界必须同时检出两个 target interaction。

## 5. 证据边界

固定：

```text
sandbox surrogate only
externalRealityVerified = false
newNaturalLawVerified = false
magicVerified = false
```

Formation 的沙箱 PASS（若执行门通过）只意味着：

> 给定一个已知生成机制，RCL 的完整 factorial 数据结构和 scorer 能否把目标效应从普通主效应、加性结构和 nuisance drift 中区分出来。

它不能证明现实中的阵法、空间约束新效应或任何魔法机制存在。

## 6. 当前工程裁决

代码、router、tests 和 demo 已落在 candidate branch。

由于仓库 GitHub Actions 当前被账户 billing / spending-limit 阻断，canonical CI 尚不能执行。因此本版本在合并前/合并时只允许标记为：

`CANDIDATE / static integration complete / canonical CI unavailable`

不得把未实际启动的 GitHub Actions 写成 PASS。

## 7. 下一门

若当前 surrogate 在可执行环境中通过，Formation 的历史状态可从：

```text
BLOCKED_PENDING_GENERIC_FULL_FACTORIAL_PAYLOAD_ADAPTER
```

升级为：

```text
READY_GENERIC_FULL_FACTORIAL_SCORER_SANDBOX_VALIDATED
REAL_INSTRUMENT_PENDING
```

之后再做 real passive sensor / external export 的 Formation acquisition package。
