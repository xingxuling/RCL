# RCL Frontier Known External Host Control v0.1

**状态**：`PASS / Phase1B first real external known-effect dataset crossed the contract`  
**RCL 基线**：v0.94.0-alpha.1 + Frontier Natural Law Lab v0.1 + Symbolic × Geometry Blindtest v0.1 + External Observation Contract v0.1  
**日期**：2026-08-11

## 0. 目标裁决

Phase1A 已经把真实数据入口做成来源、校准、根绑定、盲化和揭盲合同，但当时走的仍是软件生成的数值控制。

Phase1B 第一刀要求更严格：

> **不再把 response 数值直接生成出来，而是从当前真实宿主机运行中采集实际 wall-clock timing observations，再把这些真实测量值送进完全相同的 External Observation Contract。**

为了避免第一份现实数据就拿“未知自然规律”冒险，本轮仍然使用一个**已知、人工制造、普通计算机科学解释充分的宿主机效应**作为正控制。

因此本轮的目标不是发现魔法，而是证明：

```text
真实运行
→ 真实时钟测量
→ provenance/calibration
→ immutable raw root
→ blind factor encoding
→ preregistered scorer
→ reveal
```

这一整条现实数据链真的能跑通。

## 1. 已知效应设计

实验仍然使用 2×2 因子，但因子只是匿名研究槽位：

```text
S = symbol slot
G = geometry slot
```

在当前正控制里，它们实际上控制普通软件等待时间：

```text
base delay = 1 ms
S active adds 2 ms
G active adds 3 ms
S×G active adds extra 8 ms
```

实际 response 不是公式直接输出，而是：

```text
Atomics.wait(... delay ...)
↓
process.hrtime.bigint()
↓
measured elapsed milliseconds
```

因此数据包含真实操作系统调度、计时器误差和宿主环境噪声。

负控制则将额外交互延迟设为 0，仅保留两个主效应，使真实测量应更接近 additive model。

## 2. 采集协议

- 每个 2×2 cell 默认 12 个观测；
- 采集顺序由固定 seed 产生稳定随机排序；
- acquisition 前执行短 warmup；
- 每次观测使用 `process.hrtime.bigint`；
- 来源记录 Node 版本、平台、架构和 CPU fingerprint；
- 原始测量在进入评分前先 seal 成 External Observation Contract；
- 评分器看不到 active/control 语义；
- 评分结束后才 reveal。

当前宿主指纹：

```text
5022c0a78bba85984d7a212ababa4b7d0509deaef10c633aa07e4f319eab7314
```

## 3. 实际结果

正控制：

```text
interaction detected = true
model winner = H_interaction
```

负控制：

```text
interaction detected = false
model winner = H_additive
```

一次封存运行得到：

```text
positive BIC margin = 387.03023986
positive |interaction delta| = 7.980273251 ms
positive standardized interaction = 224.647701542
externalRealityVerified = false
```

本次 runner evidence root：

```text
2961484a8bcb90d6104b606b4a0c0f719d8a30016a27c791d1f369216fdd959d
```

由于这是实时采样，后续重跑会产生新的时间戳、measurement noise 与 root；这不是 determinism failure。真正应保持的是协议、门槛、分类语义和证据结构。

## 4. 为什么这一步重要

此前我们已经有：

```text
候选机制生成
→ 数学化
→ 合成世界
→ 合成 blindtest
→ 数据合同
```

现在第一次多了一条：

```text
真实宿主机
→ 实际观测
```

所以 Frontier Research Stack 的边界从“能判断自己制造的 synthetic signal”推进到“能接住现实机器真正测出来的数据，并且不改变原来的盲测规则”。

这一步不会让任何魔法命题更真，但它让之后的公开科学数据、传感器、实验仪器进入同一 Evidence Ledger 成为真实工程路径。

## 5. 多文明联邦裁决

- **Founder Twin**：第一份真实数据选已知普通效应，而不是直接测试未知魔法候选。
- **柳清莲 Gate**：ordinary software timing evidence 不允许被包装成新物理。
- **洞哥 Grounding**：response 必须来自实际计时器测量，不允许把注入公式结果直接写入 response。
- **产品文明**：研究者看到的是 known-control PASS / null / residual，而不是神秘叙事。
- **UX / 设计文明**：输出 contract、blind score、reveal、host fingerprint 与 evidence class。
- **工程文明**：复用 Phase1A contract 与 Phase0.5 scorer，不创建旁路。
- **代码文明**：实际 acquisition 与评分逻辑分离。
- **测试文明**：必须正控制检出、additive 负控制拒绝、contract validation PASS。
- **安全文明**：仅普通本地软件等待与计时，无设备驱动、人体或高能实验。
- **发布文明**：源码、runner、真实测量合同和评分报告一起交付。
- **Integration Court**：PASS 的对象是“第一份真实宿主测量进入研究栈”，不是未知自然规律。
- **Evidence Ledger**：保留 host fingerprint、acquisition timestamps、raw root、contract root、score/reveal roots。

## 6. 下一门：Phase1C

下一轮优先做**真正独立于 RCL 进程的外部数据来源**：

1. 公开科学数据集 adapter；
2. 单独进程 / 单独设备采集后导入 JSON；
3. 低风险传感器数据；
4. 最后才让未知自然规律候选进入同一管线。

理想 Phase1C 要实现：

```text
RCL 在数据产生时不在场
→ 数据由外部来源产生
→ 原始文件先 seal
→ RCL 之后才读取
→ scorer 仍然不知道条件语义
```

这会进一步切断“研究程序自己制造了想看到的结果”的可能性。

**边界**：本版本证明现实宿主机的普通已知软件效应可以通过 RCL 的外部观测合同与盲测栈；不证明任何超自然、魔法或新物理效应。
