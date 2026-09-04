# 万风剑道 × UGIS 3D 格斗原型 v0.3
## 人物模型与动作精修开发清单

状态：`IMPLEMENTATION PLAN / GAMEPLAY PRESENTATION REFINEMENT`

目标版本：`v0.3.x`

---

# 0. 本阶段一句话目标

> **先把角色做得像角色，把招式做得像招式，把命中做得像命中。**

v0.2 已经证明：

- 浏览器 3D Game Client 可以玩；
- 玩家可以直接操控万风剑士；
- UGIS AI 可以按高层路线运行；
- 难度系统已经把普通玩家模式和研究型“天机”模式拆开；
- 当前主要短板已从“没有游戏”转成“人物模型与动作仍像程序化原型”。

v0.3 不再优先扩新系统，而是把 **Character Presentation（人物表现）** 与 **Combat Motion（战斗动作）** 提升到真正可作为游戏内容继续迭代的水准。

---

# 1. v0.3 必须解决的问题

当前 `HumanoidFighter.jsx` 同时承担：

- 模型几何；
- 骨架层级；
- 动作姿态；
- 技能动作；
- 受击姿态；
- 格挡姿态；
- 移动腿部摆动；
- 武器发光；
- 受击闪白；

这导致当前动画本质仍是：

```text
action name
→ 直接改几组 limb Euler rotation（肢体欧拉角）
→ 用 sin / lerp（正弦 / 插值）过渡
```

它能动，但存在以下结构问题：

1. **动作逻辑和模型耦合**：换模型就得重写动作。
2. **动作没有真正 Key Pose（关键姿势）概念**：缺准备、发力、命中、收招四段结构。
3. **没有 Pelvis / Spine / Chest（骨盆 / 脊柱 / 胸廓）分层**：导致攻击主要靠手臂甩。
4. **足底没有 Plant（踩地）约束**：移动容易滑。
5. **剑柄 / 手 / 前臂不是完整运动链**：持剑稳定性差。
6. **受击只有一套姿态**：轻击、重击、破防缺少层级。
7. **Game Runtime 与 Presentation Runtime 边界不够清楚**。

v0.3 的第一原则是：

> **不能再往现有 `HumanoidFighter.jsx` 继续塞更多 `if (action === ...)`。**

---

# 2. v0.3 Scope（范围）

## 2.1 必做

- [ ] 新程序化低模角色 Rig（骨架）
- [ ] 万风剑士与剑道原型差异化外观
- [ ] 动作数据与模型组件分离
- [ ] Key Pose / Motion Clip（关键姿势 / 动作片段）系统
- [ ] Idle（待机）
- [ ] Forward / Backward / Strafe（前进 / 后退 / 侧移）
- [ ] Dash（瞬步）
- [ ] Jump / Land（跳跃 / 落地）
- [ ] Guard（格挡）
- [ ] Light 1 / 2 / 3（三段斩）
- [ ] Heavy（重斩）
- [ ] AI Thrust（取线突刺）
- [ ] AI Heavy（近域重斩）
- [ ] 风吹皆动
- [ ] 万风皆引
- [ ] 暴风终无声
- [ ] Light Hit / Heavy Hit（轻受击 / 重受击）
- [ ] Guard Impact（格挡冲击）
- [ ] Knockback（击退）
- [ ] Victory / Defeat（胜利 / 败北）
- [ ] 攻击动作与现有有效判定时间对齐
- [ ] Foot Plant（足底踩地）近似约束
- [ ] Sword Grip（持剑）稳定约束
- [ ] 更清晰的 Sword Trail（剑轨）
- [ ] 轻 / 重 / 技能三级 Hitstop（命中停顿）表现
- [ ] 摄像机动作细化

## 2.2 明确不做

本阶段禁止 Scope Creep（范围膨胀）：

- [ ] 不做联网
- [ ] 不做 Rollback Netcode（回滚网络）
- [ ] 不新增第三名正式角色
- [ ] 不重写 UGIS Core
- [ ] 不增加新 AI 架构
- [ ] 不接 LLM
- [ ] 不做真实人体伤害模拟
- [ ] 不做复杂布料物理
- [ ] 不做完整 Ragdoll（布娃娃）
- [ ] 不先做大型场景
- [ ] 不先做装备系统

---

# 3. 新模块边界

目标架构：

```text
UGIS
高层战术路线
        │
        ↓
Game Runtime
战斗真值 / 输入 / HP / 能量 / 命中 / 硬直
        │
        ├───────────────┐
        ↓               ↓
Motion State        Presentation Events
动作状态              表现事件
        │               │
        └───────┬───────┘
                ↓
        Motion Runtime
        动作采样器
                ↓
            Pose
        角色姿态快照
                ↓
          Fighter Rig
         人物骨架 / 模型
                ↓
         React Three Fiber
```

硬边界：

### UGIS 拥有

- 守间合
- 取线进位
- 截路
- 接触控线
- 压缩入近域
- 近域收束
- 脱线再入
- 归轴复位
- 断处生路
- 换节奏
- 流路连续

### Game Runtime 拥有

- 当前 Action（动作）
- Attack Phase（攻击阶段）
- 命中是否合法
- HP / Energy
- Hitstun（受击硬直）
- Guard（格挡）
- Dash / Jump
- Win / Lose

### Motion Runtime 只拥有

- 这一刻人物应该摆成什么姿势
- 动作如何从关键帧过渡
- 哪只脚应该进入 planted（踩地）状态
- 剑轨视觉如何生成

### Motion Runtime 禁止

- 自己决定攻击命中
- 自己修改 HP
- 自己修改 UGIS Route
- 用动画帧反向改变战斗真值
- 直接决定世界坐标运动

World Root Movement（世界根运动）仍由 Game Runtime 拥有。

---

# 4. 目标文件结构

v0.3 建议把当前 `HumanoidFighter.jsx` 拆成：

```text
src/
├─ characters/
│  ├─ FighterRig.jsx
│  ├─ WanFengFighterModel.jsx
│  ├─ KendoFighterModel.jsx
│  ├─ rigDefinition.js
│  └─ modelPalette.js
│
├─ motion/
│  ├─ motionRuntime.js
│  ├─ motionClips.js
│  ├─ motionPose.js
│  ├─ motionEasing.js
│  ├─ locomotionClips.js
│  ├─ combatClips.js
│  ├─ skillClips.js
│  └─ reactionClips.js
│
├─ presentation/
│  ├─ SwordTrail.jsx
│  ├─ HitSpark.jsx
│  ├─ GuardImpact.jsx
│  ├─ MotionFx.jsx
│  └─ CombatCamera.jsx
│
├─ GameScene.jsx
├─ gameRules.js
├─ ugisAi.js
└─ ...
```

兼容策略：

- `HumanoidFighter.jsx` 可以先保留为 compatibility wrapper（兼容壳）；
- 新 Rig 稳定后再删除旧实现；
- 每一步保持现有 Game Runtime 能跑。

---

# 5. 新 Rig（骨架）规范

## 5.1 骨架层级

必须从现在的“躯干 + 四肢”升级为至少：

```text
fighterRoot
└─ visualRoot
   ├─ pelvis
   │  ├─ spineLower
   │  │  └─ chest
   │  │     ├─ neck
   │  │     │  └─ head
   │  │     ├─ clavicleL
   │  │     │  └─ upperArmL
   │  │     │     └─ lowerArmL
   │  │     │        └─ handL
   │  │     └─ clavicleR
   │  │        └─ upperArmR
   │  │           └─ lowerArmR
   │  │              └─ handR
   │  │                 └─ swordGrip
   │  ├─ thighL
   │  │  └─ shinL
   │  │     └─ footL
   │  └─ thighR
   │     └─ shinR
   │        └─ footR
   └─ accessories
      ├─ sash
      ├─ coatTailL
      └─ coatTailR
```

## 5.2 必须存在的控制节点

- root
- pelvis
- spine
- chest
- head
- shoulder L/R
- upper arm L/R
- forearm L/R
- hand L/R
- thigh L/R
- shin L/R
- foot L/R
- sword grip

### 关键原则

> 攻击动作必须从 **pelvis → spine → chest → shoulder → arm → hand → sword** 形成完整动力链。

不能再只有手臂旋转。

---

# 6. 人物外观规范

## 6.1 万风剑士

视觉关键词：

```text
轻
流动
不对称
蓝白
长线条
风痕
高速
```

### 轮廓

- 偏瘦长
- 肩甲轻量
- 腰部明显收束
- 下摆 / 披带形成运动方向
- 剑身细长
- 手臂与腿更强调速度感

### 配色

- 主：深蓝 / 天蓝
- 辅：白 / 银
- 点缀：青蓝发光

### 独有部件

- 一条非对称腰带 / 披带
- 两片短衣摆
- 剑柄带蓝色能量纹

## 6.2 剑道原型

视觉关键词：

```text
稳
正
压制
厚重
橙黑
中心线
截断
```

### 轮廓

- 肩线更平
- 躯干略厚
- 下盘更稳
- 武器视觉重量略大
- 衣摆更短、更收束

### 配色

- 主：黑 / 深棕
- 辅：橙
- 点缀：暖白 / 金属灰

## 6.3 v0.3 美术约束

第一版仍优先程序化 Geometry（几何体）完成，不把进度绑定到外部高模。

但模型组件必须支持未来替换成 GLB / glTF Rigged Character（带骨骼角色）而不重写 Motion Runtime。

---

# 7. Pose（姿态）数据结构

每个动作不能再写成散落的 if/else。

建议统一 Pose：

```js
{
  root:      { x, y, z, pitch, yaw, roll },
  pelvis:    { pitch, yaw, roll },
  spine:     { pitch, yaw, roll },
  chest:     { pitch, yaw, roll },
  head:      { pitch, yaw, roll },

  armL: {
    shoulder: { pitch, yaw, roll },
    elbow:    { pitch, yaw, roll },
    hand:     { pitch, yaw, roll },
  },

  armR: { ... },

  legL: {
    hip:  { pitch, yaw, roll },
    knee: { pitch, yaw, roll },
    foot: { pitch, yaw, roll },
  },

  legR: { ... },

  sword: {
    roll,
    trail,
  },

  body: {
    heightOffset,
    squash,
  }
}
```

Pose 只表示局部姿态，不表示世界坐标。

---

# 8. Motion Clip（动作片段）规范

建议：

```js
{
  id: 'light1',
  duration: 0.42,
  loop: false,
  blendIn: 0.06,
  blendOut: 0.08,
  keyframes: [
    { t: 0.00, pose: READY },
    { t: 0.18, pose: ANTICIPATION },
    { t: 0.40, pose: STRIKE },
    { t: 0.62, pose: FOLLOW_THROUGH },
    { t: 1.00, pose: RECOVERY },
  ],
  markers: {
    activeStart: 0.14,
    activeEnd: 0.24,
  }
}
```

注意：

- `t` 建议采用 normalized time（0~1 标准化时间）；
- `markers.activeStart/End` 必须映射现有 Game Rule；
- 动画不能擅自改规则帧；
- Game Rule 是 Canonical（规范真值）。

---

# 9. 动作设计总原则

每个攻击动作必须至少有四段：

```text
Anticipation
准备 / 蓄势
↓
Acceleration
加速 / 发力
↓
Impact
命中 / 剑路穿越
↓
Recovery
收招 / 回轴
```

禁止：

```text
待机
↓
突然手臂旋转 120°
↓
回待机
```

---

# 10. 现有攻击动作与 v0.3 表现目标

以下 Game Rule 时间保持不变，v0.3 只精修表现。

| Action | Duration | Active Window | v0.3 视觉目标 |
|---|---:|---:|---|
| light1 风切·一 | 0.42s | 0.14–0.24s | 右侧斜入，腰胯先行，短促切线 |
| light2 风切·二 | 0.46s | 0.15–0.27s | 反向回斩，利用上一招余势 |
| light3 风切·三 | 0.56s | 0.18–0.33s | 大幅收束斩，明显终结感 |
| heavy 破势重斩 | 0.78s | 0.31–0.46s | 清晰蓄势 → 跨步 → 重压 |
| skill_u 风吹皆动 | 0.50s | 0.13–0.27s | 瞬时换位 + 截线斩 |
| skill_i 万风皆引 | 0.72s | 0.24–0.46s | 引线 → 转体 → 大范围变线 |
| skill_o 暴风终无声 | 1.02s | 0.38–0.61s | 安静蓄势 → 爆发一步 → 终结斩 |
| ai_thrust 取线突进 | 0.50s | 0.16–0.29s | 中心线突刺，动作短、稳、直 |
| ai_heavy 近域重斩 | 0.76s | 0.30–0.48s | 压住中心 → 重心向前 → 大力斩 |

---

# 11. 基础 Locomotion（移动）动作

## 11.1 Idle（待机）

必须包含：

- 微呼吸
- 重心微移
- 持剑尖端微漂移
- 头部轻微锁定对手
- 不得像雕像

验收：

- 5 秒待机不重复明显机械摆动；
- 手、剑、肩、胸至少四层有微运动；
- 脚底不滑。

## 11.2 Forward（前进）

不是“腿钟摆”。

必须有：

- 前脚落地
- 后脚推进
- pelvis 前移
- chest 保持面对敌方
- 剑尖保持威胁线

## 11.3 Backward（后退）

不能把前进倒放。

重点：

- 后脚先开空间
- 前脚回收
- 躯干不后仰失衡
- 剑仍保持防御线

## 11.4 Strafe（侧移）

必须：

- 交叉步 / 滑步二选一，先使用滑步
- 胸口维持敌方方向
- 脚尖不要完全朝移动方向

## 11.5 Dash（瞬步）

表现：

```text
压低重心
↓
前脚抓地
↓
身体整体弹出
↓
短暂风痕
↓
恢复剑架
```

瞬步不能像角色在地面瞬移滑动。

---

# 12. Foot Plant（足底踩地）约束

v0.3 不要求完整 IK（逆向运动学），但至少需要 Approximate Foot Plant（近似踩地）。

实现建议：

每个 locomotion clip 定义：

```js
plant: {
  left:  [0.00, 0.22],
  right: [0.48, 0.72],
}
```

处于 plant window（踩地窗口）时：

- 脚踝旋转锁定或强阻尼；
- leg swing 幅度下降；
- pelvis offset 配合另一腿移动。

验收：

- 1080p 正常镜头下，不应明显看到“脚在地上滑 20cm”；
- 已踩地脚的视觉漂移目标 < 0.08m；
- 侧移时双脚不可同时离地漂移。

---

# 13. Sword Grip（持剑）约束

剑必须挂在 `handR → swordGrip` 链上。

禁止直接把 Sword 放在 `forearm` 下面长期当手。

要求：

- 手腕节点存在；
- 剑柄轴与手掌轴一致；
- heavy / skill_o 时允许腕部有限补偿；
- swordGrip 不参与世界位移；
- 动作中剑柄不得肉眼脱手。

验收：

- 任意攻击帧，剑柄与右手中心视觉距离 < 0.04m；
- 格挡状态剑柄不穿胸；
- 轻斩 1/2/3 切换时不瞬移换手。

---

# 14. Combat Motion（战斗动作）清单

## 14.1 三段轻斩

### Light 1 — 风切·一

设计：

- 前脚探步
- pelvis 小幅旋转
- chest 后跟
- 右肩最后加速
- 剑从外侧切入中心线

目标：**快、短、清楚。**

### Light 2 — 风切·二

设计：

- 利用 Light 1 的 Follow Through（随挥）
- 腰胯反向回转
- 不重新完全归零
- 剑路从另一侧返切

目标：**连续，而不是第二次独立挥手。**

### Light 3 — 风切·三

设计：

- 明显更大跨步
- 上身扭转幅度增加
- 斩完后具有短暂停顿
- 与前两段形成“收束”

目标：**玩家一眼认出 Combo Ender（连段终结）。**

---

# 15. Heavy — 破势重斩

动作结构：

```text
0–25%
提剑 / 蓄力

25–40%
前脚压地 / 腰胯锁定

40–60%
胸肩 + 手臂同步加速

60–75%
剑路穿越

75–100%
明显收招
```

表现目标：

- 不只是“慢版 light”；
- 命中必须比 light 有更长 Hitstop；
- 镜头可以轻微前推；
- 未命中时后摇肉眼可读。

---

# 16. 万风技能动作

## 16.1 风吹皆动

动作关键词：

```text
观察
换位
截线
一闪
```

视觉：

- pelvis 先转
- 脚步快速侧前移动
- sword trail 短而亮
- 命中后迅速恢复架势

禁止做成长距离“飞过去”。

## 16.2 万风皆引

动作关键词：

```text
引
转
借势
改线
```

视觉：

- 前半段剑尖先走一个引导弧
- chest 旋转幅度大于 pelvis
- 后半段 pelvis 跟进重新统一
- sword trail 形成较完整弧线

## 16.3 暴风终无声

动作关键词：

```text
静
收
爆
止
```

设计：

- 前 30~35% 几乎不动，只压低重心；
- 35~45% 突然前移；
- 45~60% 主斩击；
- 命中有强 Hitstop；
- 斩后人物保持 0.1~0.15s 定势再恢复。

必须让玩家“看到安静 → 突然爆发”的反差。

---

# 17. 对手剑道动作风格差异

剑道原型不能只是橙色万风。

## 动作语言

万风：

```text
侧
变
流
绕
连续
```

剑道原型：

```text
正
直
压
截
稳定
```

### AI Thrust（取线突进）

- pelvis 低幅度
- chest 稳定
- 双肩保持中心线
- sword path 尽量直

### AI Heavy（近域重斩）

- 双脚站距更稳
- 上身准备幅度更小
- 出手时整体重心一起压过去
- 收招仍保持前方防线

---

# 18. Reaction（受击）动作

至少四类：

```text
hit_light
hit_heavy
hit_guard
knockback
```

## hit_light

- chest 快速偏转
- head 延迟一点跟随
- pelvis 尽量稳定
- 0.15~0.25s 回正

## hit_heavy

- pelvis 明显后移
- chest 后仰
- 手臂被打散
- 剑位下降
- 恢复更慢

## hit_guard

- 前臂 / 剑受到短冲击
- chest 轻微震动
- pelvis 稳住
- 不应和普通受击一样后仰

## knockback

- 身体先失衡
- 脚步被迫后移
- 上身恢复晚于位移

---

# 19. Animation Blending（动画混合）

至少支持：

```text
Idle ↔ Move
Move → Attack
Attack → Recovery
Recovery → Idle
Any → Hit
Any → Guard（规则允许时）
Hit → Recover
```

推荐：

- Idle/Move：0.10–0.16s blend
- Move/Attack：0.04–0.08s
- Hit override：0.02–0.05s
- Victory/Defeat：0.18–0.28s

Hit（受击）必须拥有较高 Presentation Priority（表现优先级）。

---

# 20. Sword Trail（剑轨）

当前武器发光不足以表达剑路。

v0.3 增加真正的短寿命剑轨：

```text
上一帧 bladeBase / bladeTip
+
当前帧 bladeBase / bladeTip
↓
生成 ribbon segment（带状片段）
↓
80~180ms 衰减
```

分级：

- Light：短、薄、蓝白
- Heavy：宽、略暖白
- 风吹皆动：高亮短线
- 万风皆引：连续弧线
- 暴风终无声：主斩超亮 + 很快消失

禁止把屏幕变成粒子烟花。

---

# 21. Hitstop / Impact（命中反馈）

Game Rule 继续拥有 hitstop 数值。

Presentation 根据已有 hitstop 做视觉分级：

| 类别 | 视觉反馈 |
|---|---|
| Light | 微停 + 小火花 |
| Heavy | 较强停顿 + 镜头轻震 + 大火花 |
| Guard | 金属冲击 + 冷色火花 + 很短停顿 |
| Skill | 发光剑轨 + 更明显停顿 |
| Ultimate | 强停顿 + 镜头推进 + 瞬时曝光 |

禁止为了好看把逻辑 hitstop 另外加倍。

---

# 22. Combat Camera（战斗镜头）v0.3

在现有 Chase Camera（追踪镜头）基础上增加：

## 22.1 距离响应

- > 4m：稍拉远
- 2~4m：默认战斗镜头
- < 2m：镜头略降低、略靠近

## 22.2 攻击响应

- Light：基本不抢镜
- Heavy：0.08~0.12m 推近
- Skill：短暂 FOV 收紧
- Ultimate：0.2~0.35s 特写，但不切硬镜头

## 22.3 命中响应

- 小伤害：轻微 shake
- 重击：短 impulse
- Guard：方向性小震动

镜头的第一目标仍然是**可读性**，不是电影感。

---

# 23. 玩家可读性标准

玩家必须仅凭动画回答：

- 这一招是轻击还是重击？
- 对手准备突刺还是重斩？
- 这一刻对方在格挡吗？
- 对手刚刚受的是轻硬直还是重硬直？
- 万风现在是风吹皆动还是万风皆引？
- 角色是在向前、后退还是侧移？

如果必须看 HUD 才知道，就算失败。

---

# 24. Performance（性能）门

v0.3 首先使用程序化低模，因此新增表现不得严重扩大包体。

目标：

- 1080p 浏览器
- DPR 1.0~1.5
- 双角色
- Sword Trail 开启
- Hit FX 开启

要求：

- 目标 60 FPS；
- 短时掉帧不得由 JS 每帧创建大量对象导致；
- Trail / Impact 必须使用对象复用或小规模池化；
- Motion Clip 不得每帧生成大对象树；
- 角色几何应尽量复用 Material / Geometry。

包体目标：

- JS 主包相对 v0.2 增幅尽量 < 15%；
- 不因人物精修突然引入几十 MB 外部资源。

---

# 25. 测试门

## 25.1 Unit Tests（单元测试）

必须新增：

- [ ] Motion Clip keyframe 时间单调递增
- [ ] 所有 combat clip duration 与 `ATTACKS` 一致
- [ ] activeStart / activeEnd markers 与 Game Rules 一致
- [ ] 所有 Rig bone name 都能被 Motion Pose 找到
- [ ] 所有动作都有 recovery pose
- [ ] 所有攻击都有 sword trail profile
- [ ] 所有 hit reaction 都不能修改 HP

## 25.2 Static Boundary Test（静态边界测试）

验证 Motion / Model 层不得 import：

- `chooseUgisRoute`
- `applyDamage`
- HP mutation
- Energy mutation

## 25.3 Browser Build Gate

每次必须：

```text
npm test
npm run build
```

均 PASS 才可合并。

---

# 26. Visual Acceptance（视觉验收）

每一轮必须人工截图 / 试玩检查，而不是只看 CI。

至少截：

1. 万风 Idle
2. 剑道 Idle
3. 双方自由间合
4. 万风 Light 2 中段
5. Heavy 命中
6. Guard Impact
7. 风吹皆动
8. 万风皆引
9. 暴风终无声
10. 轻受击
11. 重受击
12. Victory

人工检查项：

- [ ] 人物是否直立
- [ ] 剑是否握在手里
- [ ] 脚是否明显滑动
- [ ] 肩膀是否脱节
- [ ] 手臂是否穿胸
- [ ] 剑是否穿自己身体
- [ ] 受击是否有重量
- [ ] 万风和剑道是否动作语言不同
- [ ] HUD 是否遮挡角色
- [ ] 镜头是否能读清距离

---

# 27. 开发阶段拆分

## Phase A — Rig Refactor / 骨架重构

目标：**人物先站得像人。**

任务：

- [ ] 新 FighterRig
- [ ] pelvis / spine / chest / neck
- [ ] hand / foot
- [ ] swordGrip
- [ ] 万风 / 剑道两套模型外观
- [ ] 旧 HumanoidFighter compatibility wrapper

验收：

- 两人站着不动也像正式低模角色；
- 剑握在手里；
- 不再是箱子躯干 + 圆柱四肢的纯占位感。

---

## Phase B — Locomotion / 移动精修

目标：**不再滑。**

任务：

- [ ] Idle
- [ ] Forward
- [ ] Backward
- [ ] Strafe L/R
- [ ] Dash
- [ ] Jump
- [ ] Land
- [ ] Approx Foot Plant

验收：

- 玩家连续绕圈 15 秒不出现明显脚底漂移；
- 后退动作不是前进倒放；
- 侧移时胸口继续朝对手。

---

## Phase C — Basic Combat / 基础战斗动作

目标：**一眼能认招。**

任务：

- [ ] Light 1
- [ ] Light 2
- [ ] Light 3
- [ ] Heavy
- [ ] Guard
- [ ] AI Thrust
- [ ] AI Heavy

验收：

- 三段斩动作连续；
- Heavy 明显比 Light 重；
- AI Thrust 和万风斩击风格明显不同；
- active window 与视觉剑路对齐。

---

## Phase D — Reaction / 受击与格挡

目标：**打中要有重量。**

任务：

- [ ] Light Hit
- [ ] Heavy Hit
- [ ] Guard Impact
- [ ] Knockback
- [ ] Hitstop 分级
- [ ] Camera impulse

验收：

- Light / Heavy 肉眼可区分；
- 格挡不像普通掉血；
- 大伤害不会只闪一下白光。

---

## Phase E — WanFeng Skills / 万风技能精修

目标：**万风开始有自己的动作语言。**

任务：

- [ ] 风吹皆动
- [ ] 万风皆引
- [ ] 暴风终无声
- [ ] Skill Trail
- [ ] Skill Camera

验收：

- 不看文字也能区分三个技能；
- 暴风终无声必须有“静 → 爆 → 止”的节奏。

---

## Phase F — Final Polish / 最终精修

目标：**拿出去给人看，不先解释“这是原型”。**

任务：

- [ ] 人物比例微调
- [ ] 材质统一
- [ ] 光照调整
- [ ] Trail 优化
- [ ] Camera 调整
- [ ] Victory / Defeat
- [ ] UI 遮挡检查
- [ ] 低性能设备降级路径

---

# 28. 优先级

## P0 — 不做就不算 v0.3

- Rig 分层
- Motion Clip 数据化
- Foot Plant
- Sword Grip
- Idle / Move / Guard
- Light1/2/3
- Heavy
- Hit Light / Heavy
- 风吹皆动 / 万风皆引 / 暴风终无声
- Sword Trail

## P1 — 强烈建议同版本完成

- Victory / Defeat
- Guard Impact
- Camera skill response
- Kendo 动作差异化
- Cloth / sash 次级摆动

## P2 — 可以留 v0.31+

- 更复杂 IK
- 两手握剑切换
- 武器碰撞姿态调整
- 外部 GLB 模型替换
- 面部表情
- 布料物理

---

# 29. 第一开发 Sprint（立即执行）

第一刀不要碰全部动作。

### Sprint 0.3-A

只做：

```text
FighterRig
+
新人物模型
+
Idle
+
Forward / Backward / Strafe
+
Guard
+
Light1
```

理由：

这 6 项足够回答一个关键问题：

> **新的 Rig + Motion Runtime，视觉上是否真的比旧 HumanoidFighter 高一个层级？**

只有这个 Gate PASS，才继续把 20 个动作全部迁过去。

### 0.3-A 验收门

必须满足：

- [ ] 人物站姿明显更像剑士
- [ ] 骨盆与胸廓能独立转动
- [ ] Light1 明显由腰胯发力
- [ ] 剑柄没有脱手
- [ ] Forward 不明显滑步
- [ ] Backward 不是 Forward 倒放
- [ ] Guard 有中心线防御感
- [ ] 万风 / 剑道静态轮廓已经不同
- [ ] 现有战斗逻辑与 UGIS AI 行为不回归
- [ ] npm test PASS
- [ ] npm run build PASS
- [ ] 实际浏览器截图人工 PASS

---

# 30. v0.3 Definition of Done（完成定义）

v0.3 完成时必须达到：

> **一个第一次打开游戏的人，不需要知道 UGIS / RCL / 万风体系背景，也会把它认成“一个真的 3D 剑术格斗原型”，而不是一个研究可视化或程序员测试场。**

并且：

1. 两名角色有明显不同的轮廓与动作语言；
2. 三段轻斩有连续性；
3. Heavy 有重量；
4. 三个万风技能可仅凭动作辨认；
5. 玩家能凭对手动作判断攻击意图；
6. 脚底不明显滑；
7. 剑不明显脱手；
8. 命中、格挡、重击反馈分级明确；
9. Motion Runtime 不拥有战斗真值；
10. UGIS 仍只负责高层路线；
11. CI 全绿；
12. 浏览器人工试玩通过。

---

# 31. 最后原则

v0.3 禁止再用：

> “功能已经实现，所以动作以后再美化。”

因为从这一版开始：

> **动作本身就是玩法信息。**

一个真正的格斗游戏里，动作既是美术，也是 UI，也是输入反馈，也是战术可读性。

万风剑道要从“系统里很聪明”变成“玩家眼睛真的看得出来它在流、在引、在变、在收束”。
