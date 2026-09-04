# 万风剑道 · UGIS 3D 格斗原型 v0.1

状态：`PLAYABLE GAME CLIENT CANDIDATE`

这个目录和 `examples/ugis-threejs-arena` 的研究可视化器是两套东西。

```text
Debug Visualizer
→ 看 ActionRoot / BridgeRoot / PlanRoot / SnapshotRoot

Fighter Game Client
→ 玩家直接移动、出招、瞬步、格挡、打 AI
```

## 当前能玩什么

玩家：万风剑士。

```text
WASD   移动 / 侧移
J      三段普通斩
H      重斩
K      跳跃
L      瞬步
F/Shift 格挡
U      风吹皆动
I      万风皆引
O      暴风终无声
```

当前包括：

- 第三人称锁定镜头；
- 程序化完整人形：头、躯干、双臂、前臂、大腿、小腿、脚；
- 训练剑真正挂在右手动作链；
- 普攻三段；
- 重斩；
- 三个万风技能；
- 风元能量；
- 格挡减伤；
- 瞬步短暂无敌；
- 跳跃与重力；
- 命中停顿 Hitstop；
- 受击闪白；
- 击退；
- 命中火花；
- 第三人称动态追踪镜头与轻微震屏；
- 胜负与重开。

## UGIS 在正式游戏里的位置

敌方 AI 不直接读取世界坐标脚本，也不会在 UI 展示研究证据树。

它先从当前游戏状态观察：

```text
距离
玩家是否正在攻击
玩家是否格挡
自身生命 / 风元
当前交战域
```

然后只选择高层路线：

```text
守间合
取线进位
截路
接触控线
压缩入近域
近域收束
脱线再入
归轴复位
断处生路
换节奏
流路连续
```

再由 Game Runtime 把路线 Lower（降级映射）成：

```text
approach / retreat / strafe / hold
+ guard / dash / thrust / heavy
```

这次特别避免上一版的问题：

> UGIS Route 不再直接等于“角色前进 0.62m”。

UGIS 只决定**想做什么**；Game Runtime 决定**身体具体怎么做**。

## 运行

```bash
cd examples/ugis-fighter-game
npm install
npm run dev
```

生产构建：

```bash
npm run build
npm run preview
```

语义边界测试：

```bash
node --test ../../tests/ugis-fighter-game.test.mjs
```

## 当前还没做

- 正式人物模型 / GLTF；
- 动捕或专业骨骼动画；
- Rapier 物理；
- 精细 Hitbox / Hurtbox 编辑器；
- 真正的在线 Python UGIS runtime 流；
- 双人本地 / 在线 PvP；
- Rollback Netcode；
- 音效与配音；
- 奥义镜头；
- 完整角色选择与更多流派。

v0.1 的门槛不是“完整格斗游戏”，而是：

> **第一眼必须已经像游戏，而且玩家能自己打。**

## Owner 边界

```text
UGIS
  owns: high-level tactical route meaning

RCL
  owns: provider/evidence/integration boundary

Game Runtime
  owns: playable combat state machine, hit resolution, motion skills

Three.js / React Three Fiber
  owns: scene presentation and animation execution
```

玩家 HUD 不展示 ActionRoot / BridgeRoot / PlanRoot / SnapshotRoot；那些继续留在 Debug Visualizer。
