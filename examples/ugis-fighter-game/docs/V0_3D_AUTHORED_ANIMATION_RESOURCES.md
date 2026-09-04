# UGIS Fighter v0.3-D — 独立动作资源

状态：`GAME PRESENTATION / AUTHORED STYLE ASSETS`

## 目标

解决 v0.3-B/C 仍然存在的核心问题：即使剑路提示、步法参数和 combo rhythm 已分开，攻击本体仍容易被肉眼识别成“同一个程序化人形在抡不同角度的剑”。

v0.3-D 将攻击动作提升为独立的 authored animation resources（编排动作资源）：

- `WANFENG_AUTHORED_ACTIONS`：单手偏置、离轴、侧切、连续转体、弧形回收；
- `KENDO_AUTHORED_ACTIONS`：双手偏置、中心线、振上、正劈、刺入、残心式回收。

旧 `motionClips.js` / `kendoMotionClips.js` 保留为 fallback，不再拥有正式攻击表现的优先级。

## 新动画通道

除骨骼欧拉角外，动作资源现在还能编排：

- `bodyOffsetX`：视觉身体横移；
- `bodyOffsetY`：沉身 / 起伏；
- `bodyOffsetZ`：前探 / 回收；
- `visualYaw`：整个人形相对锁定方向的视觉转身；
- `weaponMode`：`one-hand-flow` / `two-hand-center`；
- `actionFamily`：用于 Evidence / debug 的动作族标签。

这些通道属于 Presentation，不改变 HP、Energy、UGIS Route 或实际 hit window。

## 剑尖轨迹

旧版使用预画的蓝色圆弧 / 橙色直线提示。v0.3-D 删除这类假轨迹，改为实时采样动画后剑尖的 world position（世界坐标），生成 ribbon trail（带状轨迹）。

因此剑轨是动作资源的结果，而不是提前告诉玩家“这应该是一条弧线”。

## 开源动作库考古

已审阅 Quaternius Universal Animation Library：

- License：CC0 1.0；
- 适合未来用作通用 locomotion / hit / fall / generic combat 的来源；
- 不在 v0.3-D 直接作为万风 / 剑道攻击 Owner，因为通用 sword animations 会重新引入流派同质化。

参考：
- Quaternius Universal Animation Library（CC0）
- J-Ponzo/gltf-universal-animation-library（CC0 GitHub 镜像）

若未来接入，必须限制在通用动作层，或经过明确 retarget + style-authoring 后才能进入流派攻击层。
