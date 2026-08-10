# Frontier Public NIST Factorial Dataset v0.1

**状态**：`PASS / Phase1D public scientific dataset ingest + methodological negative result`  
**日期**：2026-08-11

## 0. 目标

Phase1C 只建立了同一宿主上的独立进程/文件边界。Phase1D 第一次使用**RCL 运行之外已经公开存在的科学实验数据**。

选用 NIST e-Handbook 的 high-performance ceramics full factorial example：32 个观测组成完整 `2^5` 设计，response 是 ceramic strength 的 15 次重复均值。

本轮不把 NIST 的已发表分析结果送给 blind scorer。先只输入原始设计表；评分完成后，才用 NIST 页面公布的 effect sum-of-squares 做 post-score holdout reproduction。

## 1. 两条分析路径

### 既有通用 2×2 blind scorer

仅把：

- speed → symbol factor
- feed rate → geometry factor

其余 grit / direction / batch 作为 nuisance variation。

结果：当前通用 2×2 scorer **没有检出 interaction**，winner=`H0_null`。

这与 NIST 已发表分析中的 speed × feed-rate interaction 不一致，因此必须记录为**方法学负结果**，不能降低阈值强行追答案。

### 新增结构保持的 2^5 orthogonal effect engine

对完整 ±1 正交设计计算每个 term：

```text
beta(term) = mean(y * product(factor levels in term))
effect = 2 * beta
sumSquares = N * beta^2
```

该计算独立复现 NIST 页面公布的关键 sums of squares，包括：

- speed
- rate
- speed×rate
- grit
- direction
- batch

## 2. 架构结论

Phase1D 的主要发现不是“又检出一个效应”，而是：

> 外部真实结构化数据暴露了通用 2×2 scorer 的适用域边界。存在强 nuisance factorial structure 时，先保留完整实验设计，再做结构对应分析；不能把所有数据压扁成 2×2 后继续沿用同一阈值。

因此后续未知自然规律数据合同需要声明 `designGrammar`，由 scorer router 选择：

```text
simple 2x2 → current blind scorer
full 2^k factorial → orthogonal / factorial scorer
repeated-measures → blocked until dedicated scorer
continuous field → blocked until dedicated scorer
```

## 3. 证据边界

本轮证明：

- RCL 可以接入独立公开科学数据；
- dataset provenance 可以绑定到公开来源；
- 完整 factorial structure 可被机器校验；
- effect engine 能复现公开分析摘要；
- 外部数据能反过来推翻/限制 RCL 自己的通用 scorer。

不证明任何未知自然规律、魔法或超自然效应。

```text
externalRealityVerified = false
newNaturalLawVerified = false
magicVerified = false
```
