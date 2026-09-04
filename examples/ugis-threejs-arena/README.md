# UGIS × RCL × Three.js 3D 剑客竞技场 v0.2

状态：`CANDIDATE / BROWSER PLACEHOLDER VISUALIZER + PROVIDER SNAPSHOT`

这个示例把 UGIS Sword Arena（剑客竞技）的动作语义投到浏览器 3D 场景，并在 v0.2 增加 Provider Snapshot（场景快照）以支持可靠的随机访问回放。

当前故意只使用：

- 胶囊式占位剑士；
- 抽象安全训练剑；
- 简单根运动；
- 路线对应剑姿；
- Evidence Inspector（证据检查器）。

目标不是先做美术，而是验证：

```text
UGIS Route
↓
Action IR / ActionRoot
↓
RCL Bridge / BridgeRoot
↓
Three.js Plan / PlanRoot
↓
Provider Snapshot / SnapshotRoot
↓
React Three Fiber scene
```

在画面、跳转和重放中持续保持同一条语义与证据链。

## 当前演示

```text
Exchange 1 · Free Measure / 自由间合
WanFeng：守间合 · 万风朝拜
Opponent：取线进位

Exchange 4 · Contact Authority / 接触控制
WanFeng：接触控线 · 你我皆风
Opponent：压缩入近域

Exchange 6 · Close Resolution / 近域解决
WanFeng：近域收束 · 引风上身
Opponent：近域收束
```

每个动作保留 `ActionRoot / BridgeRoot / PlanRoot`；每个 exchange 另外拥有一个 Provider `SnapshotRoot`。

## Provider Snapshot

v0.1 不能安全地“上一交换 / 任意跳转”，因为角色位置是逐步累积的。如果从 Exchange 6 直接回到 Exchange 1 再执行旧动作，角色会从错误位置出发。

v0.2 改成：

```text
选择 exchange
↓
恢复该 exchange.before
↓
正向播放该 exchange 的动作
↓
到达 exchange.after
```

因此现在支持：

- 上一交换；
- 下一交换；
- 任意时间轴点击；
- 重放当前；
- 重置；
- 自动播放。

注意：这仍然不是“倒放动画”。回到旧 exchange 后，会从它的 before 快照重新正向执行。

快照只属于 Three.js Provider projection（表现层投影），不升级成 UGIS 战斗真相。

## 快照内容

```text
exchange
regime
before:
  fighter:wanfeng x/z milli
  fighter:opponent x/z milli
after:
  fighter:wanfeng x/z milli
  fighter:opponent x/z milli
action_roots[]
plan_roots[]
root = RCL realityRoot(payload)
```

坐标使用 fixed-point milli（1/1000 定点整数）。

当前快照链要求：

```text
snapshot[n].after == snapshot[n+1].before
```

并始终保持两名占位剑士的 Provider 最小分离距离。

## 运行

```bash
cd examples/ugis-threejs-arena
npm install
npm run validate
npm run dev
```

生产构建：

```bash
npm run build
npm run preview
```

## 验证

`npm run validate` 包含两层：

```text
validate:timeline
→ Action / Bridge / Plan 时间轴结构

validate:snapshots
→ 从真实 demoTimeline 重新生成 Provider Snapshot
→ RCL realityRoot 重算 SnapshotRoot
→ 与提交的 demoSnapshots.js deepEqual
```

RCL 根测试另外检查：

- 每个 exchange 恰好双方各一个动作；
- 双方 regime 一致；
- Free / Contact / Close 全覆盖；
- ActionRoot / BridgeRoot / PlanRoot 合法；
- SnapshotRoot 可由 RCL `realityRoot` 重算；
- ActionRoot / PlanRoot 与当前 exchange 完全绑定；
- 快照 before / after 连续；
- 两名 Provider 角色保持最小分离。

## Three.js Provider 的当前职责

浏览器不重新做 UGIS 决策，也不再自行猜“历史位移应该是多少”。

v0.2 只负责：

```text
恢复 Provider before snapshot
↓
插值到 Provider after snapshot
↓
持续 face target
↓
按 Route 显示剑姿 / 竞技提示
```

快照本身由 Action timeline 的 actor-relative semantic motion（行动者相对对手的语义运动）生成并带 RCL Root。

## UI

- 3D Arena（3D 竞技场）；
- Play / Pause / Previous / Next / Reset / Replay（播放 / 暂停 / 上一交换 / 下一交换 / 重置 / 重放当前）；
- 可点击 Free / Contact / Close 时间轴；
- WanFeng / Opponent inspector（双方检查器）；
- ActionRoot / BridgeRoot / PlanRoot / SnapshotRoot 证据根。

## 安全边界

硬边界继续继承：

```text
competition-resolution-only
no-anatomical-targeting
no-harm-optimization
```

它不定义人体攻击目标，不优化现实伤害、致残或武器杀伤，也不把模拟表现解释成现实武术排名。

## 当前还没做

- 正式人物模型；
- 骨骼动画重定向；
- AnimationMixer（动画混合器）/ 动画图；
- Rapier 物理；
- 攻击框 / 受击框；
- 实时从 Python UGIS runtime 流入浏览器；
- 双人真人输入；
- Rollback（回滚同步）；
- 真正反向时间播放。

这些能力继续建立在现有 ActionRoot → BridgeRoot → PlanRoot → SnapshotRoot 证据链上，而不是另写一套不可追溯的游戏逻辑。
