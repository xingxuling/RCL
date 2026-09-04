# RCL × UGIS Action Bridge v0.1

状态：`CANDIDATE / INTEGRATION BRIDGE / PROVIDER ENVELOPE`

## 目标

把 UGIS 拥有的战术动作语义接入 RCL Reality / Gate（实境核 / 能力门），再交给 Three.js Provider 执行，同时保留完整 Evidence（证据）链。

```text
UGIS Route
↓
UGIS Action IR
↓ ActionRoot
RCL UGIS Action Bridge
↓ BridgeRoot
Three.js Action Plan
↓ PlanRoot
Provider execution
↓
Provider Receipt
```

## Owner / 语义所有权

```text
UGIS
owns:
- route meaning
- measure / line / contact / resolution intent
- Sword Arena domain semantics

RCL
owns:
- governed provider envelope
- authority requirement
- preserve boundary
- evidence linkage

Three.js Provider
owns:
- scene lookup
- root motion execution
- animation realization
- visual cue realization
```

RCL bridge 明确写入：

```text
semantic_owner = UGIS
rcl_role = reality-transition-provider-envelope
```

因此本桥不是新的 `RCL Combat Core`。

## Cross-language ActionRoot

UGIS Python 端固定 fixture：

```text
route = hold_measure / 守间合
actor = fighter:a
opponent = fighter:b
exchange = 1
regime = free
```

ActionRoot：

```text
282785e8df9bfd9e528fd07f91f3c1c76dc17d01d390b23dc0c84c39abc05719
```

RCL test 使用自己的 `realityRoot()` 对 fixture 去掉 `root` 后重新计算，必须得到完全相同结果。

修改任一 canonical 字段，例如 `magnitude_milli + 1`，验证必须失败。

## 为什么使用 fixed-point integer

Python 与 JavaScript 对某些浮点数字符串序列化可能不同。

因此 UGIS Action IR canonical payload 不直接使用 float，连续量使用：

```text
magnitude_milli
potential_milli
route_cost_milli
...
```

RCL 不需要特殊 Action 哈希算法，直接使用现有 `canonicalReality / realityRoot` 即可。

## RCL Bridge Envelope

Bridge 记录：

- `source_action_root`；
- actor / opponent；
- provider capability authority；
- UGIS constraints → RCL preserves；
- provider host call；
- action-root evidence node。

Three.js 默认 capability：

```text
threejs.applyActionIntent
```

注意：这只是 Provider capability 名，不表示 RCL Core 内置 Three.js。

## Three.js Action Provider Plan

当前 Provider plan 生成四类操作：

```text
face-target
root-motion-semantic
animation-tags
competition-cue
```

其中 `root-motion-semantic` 仍使用：

```text
reference_frame
direction
magnitude_milli
```

而不是直接写死世界坐标。真实 Three.js adapter 必须根据当前 actor / target Transform（变换）解析。

## Provider Receipt

成功执行后必须产生 receipt（回执）：

```text
plan_root
source_action_root
bridge_evidence_root
applied[]
status = applied
root
```

所以视觉执行不会切断 Replay / Evidence 链。

## 当前验证

独立 headless 测试已经覆盖：

1. Python ActionRoot == RCL realityRoot；
2. tamper（篡改）Action IR 会失败；
3. RCL bridge 保留 `semantic_owner = UGIS`；
4. bridge root 可确定性重放；
5. fake Three.js adapter 执行四类操作；
6. Provider receipt 继续链接 ActionRoot 与 BridgeRoot。

## 下一步

接真实浏览器 Provider：

```text
React
↓
React Three Fiber
↓
Three.js scene
↓
ThreeJsActionAdapter
├─ faceTarget()
├─ applyRootMotion()
├─ playAnimationTags()
└─ emitCompetitionCue()
```

第一版可以只用胶囊体 + 占位训练剑，不需要先等正式人物美术。
