# UGIS × RCL × Three.js 3D 剑客竞技场 v0.1

状态：`CANDIDATE / BROWSER PLACEHOLDER VISUALIZER`

这是第一版真正把 UGIS Sword Arena（剑客竞技）的动作语义投到浏览器 3D 场景里的示例。

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
React Three Fiber scene
```

在画面上保持同一条语义与证据链。

## 当前演示

时间轴包含三个交战阶段：

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

每个动作都保留：

- `ActionRoot`；
- `BridgeRoot`；
- `PlanRoot`；
- Route（路线）；
- WanFeng Form（万风式，如适用）；
- semantic root motion（语义根运动）；
- animation tags（动画标签）；
- competition cue（竞技提示）。

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

## 静态验证

`npm run validate` 不需要浏览器，它会检查：

- timeline 格式；
- 每个 exchange 恰好两名剑士各一个动作；
- 双方交战域一致；
- Free / Contact / Close 三域全部出现；
- Route 必须来自当前 UGIS Sword Route 目录；
- `magnitudeMilli` 必须是 fixed-point integer（定点整数）；
- ActionRoot / BridgeRoot / PlanRoot 必须是 64 位小写 SHA-256；
- ActionRoot 不允许重复。

## Three.js Provider 的当前职责

浏览器不会自己重新做 UGIS 决策。

它只把上游动作意图 Lower（降级映射）成：

```text
face target / 面向对手
semantic root motion / 语义根运动
route sword pose / 路线剑姿
competition cue / 竞技提示
```

`forward / forward-angle / lateral / adaptive` 等方向都相对于**当前 actor → target（行动者→对手）参考系**解析，不是固定世界坐标。因此双方换边后动作会自动镜像，而不是播放一套死舞步。

## UI

页面分成：

- 3D Arena（3D 竞技场）；
- Play / Pause / Step / Reset（播放 / 暂停 / 单步 / 重置）；
- Free / Contact / Close timeline（三域时间轴）；
- WanFeng / Opponent inspector（双方状态检查器）；
- ActionRoot / BridgeRoot / PlanRoot 证据根。

## 安全边界

本示例只表达安全竞技中的路线与视觉反馈。

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
- AnimationMixer / 动画混合图；
- Rapier 物理；
- 攻击框 / 受击框；
- 实时从 Python UGIS runtime 通过网络流入浏览器；
- 双人真人输入；
- Rollback（回滚同步）。

这些都应该建立在本版“ActionRoot 到画面仍可追溯”的桥上，而不是绕过它另写一套游戏逻辑。
