# Frontier Design Grammar + Scorer Router v0.1

**状态**：`PASS / Phase1E structure-aware scorer routing`  
**日期**：2026-08-11

## 0. 目标裁决

Phase1D 的 NIST 公共科学数据反向打穿了 RCL Frontier 的一个假设：**同一个通用 2×2 scorer 不能被默认用于所有实验结构。**

NIST `2^5` 数据被压扁成 speed × rate 的 2×2 投影后，既有 scorer 给出 `H0_null`；保留完整正交设计的 factorial engine 则复现了 NIST 已发表 sums of squares。因此这一轮不降低阈值，而是把“实验设计语法”提升为 scorer 选择前的强制类型。

## 1. Design Grammar

当前支持：

```text
simple_2x2
full_factorial_2powk
```

显式阻断：

```text
repeated_measures
continuous_field
```

每个 grammar 至少声明 family、factors、nuisanceFactors、response、levelEncoding、expectedCellCount、targetTerms 和 declaredBeforeScoring。

## 2. Scorer Router

```text
Design Grammar
→ validation
→ compatible scorer
→ score
```

路由：

```text
simple_2x2 → Frontier Symbolic × Geometry blind 2×2 scorer
full_factorial_2powk → structure-preserving orthogonal factorial scorer
unsupported grammar → BLOCKED
```

没有 fallback。

## 3. 不变量

1. design grammar 必须在 scoring 前声明。
2. `simple_2x2` 恰好只能声明两个 factor。
3. 已知存在 structured nuisance factors 时，不允许静默压扁成 simple 2×2。
4. full factorial 必须使用 `pm1` 编码，expected cells = `2^k`。
5. repeated-measures / continuous-field 在没有专用 scorer 前直接 `BLOCKED`。
6. unsupported design 不得自动退回 generic scorer。
7. 所有 route 保留 `externalRealityVerified=false`。

## 4. NIST 回验

NIST ceramic `2^5` 现在声明：

```text
family = full_factorial_2powk
factors = [speed, rate, grit, direction, batch]
expectedCellCount = 32
```

因此路由到 factorial scorer；`speed_rate.sumSquares` 继续得到约 `4872.5724`。

## 5. 多文明联邦裁决

- **Founder Twin**：把问题重命名为“实验结构决定可合法使用的统计语义”。
- **柳清莲 Gate**：禁止因为 scorer 没检出预期结果而事后松阈值。
- **洞哥 Grounding**：数据结构与 scorer 必须有可检查类型对应。
- **产品文明**：研究者只需看到 design grammar、route、score、blocked reason。
- **UX / 设计文明**：unsupported 显示为“缺专用 scorer”，不伪装成实验失败。
- **工程文明**：路由复用已有 scorer，不复制统计实现。
- **代码文明**：router 不包含结果驱动阈值调参。
- **测试文明**：覆盖 2×2、2^k、结构损失阻断、unsupported 阻断、确定性 root。
- **安全文明**：分析错误先被隔离，不让错误 scorer 进入现实结论。
- **Integration Court**：只有 `fallbackUsed=false` 才允许 PASS。

## 6. 下一门

下一阶段把 `designGrammar` 正式接进 External Observation Contract，并建立：

```text
contract.designGrammar
→ scorer router
→ preregistered analysis plan
→ score
```

未知规律候选进入现实证据链前，必须先声明实验结构，而不是先看数据再挑统计方法。
