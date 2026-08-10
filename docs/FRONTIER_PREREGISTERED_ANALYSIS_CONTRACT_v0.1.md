# Frontier Preregistered Analysis Contract v0.1

**状态**：`PASS / Phase1F sealed design + scorer + payload analysis plan`  
**日期**：2026-08-11

## 0. 目标裁决

Phase1E 已经让实验结构决定 scorer。Phase1F 进一步要求：**design grammar、payload root、scorer route 与分析政策必须在 scoring 前一起 seal**。

```text
Design Grammar
+ Payload Root
+ Registered Scorer Route
+ Analysis Plan
→ Sealed Analysis Contract
→ Validate roots
→ Execute only registered route
→ Score
```

## 1. Sealed fields

- `designRoot`
- `payloadRoot`
- `registeredRoute`
- `analysisPlanRoot`
- `contractRoot`

Analysis plan 固定：primary targets、decision policy、holdout policy、randomization seed、missing-data policy，以及 `fallbackPolicy=forbidden`。

## 2. Fail-closed rules

以下任一变化都会在评分前拒绝：

- design grammar seal 后变化；
- payload seal 后变化；
- analysis plan seal 后变化；
- registered route 与 design family 不一致；
- fallback policy 被改写；
- unsupported design family；
- design grammar 本身不合法。

拒绝状态为 `REJECTED_BEFORE_SCORE`，且 `scoreExecuted=false`。

## 3. 当前验证

- known 2×2 interaction：seal → registered 2×2 scorer → detected，PASS。
- NIST `2^5`：seal → registered factorial scorer → speed×rate SS 约 `4872.57`，PASS。
- design tamper：评分前拒绝，PASS。
- payload tamper：评分前拒绝，PASS。
- continuous-field unsupported：不能 seal，PASS。

新测试 `5/5 PASS`；与 Phase1D/1E 联合选择性回归 `14/14 PASS`。

## 4. 多文明联邦裁决

- **Founder Twin**：把“预注册”落实为机器可验证的 root-bound contract，而不是文档承诺。
- **柳清莲 Gate**：禁止 score 后改变 scorer、目标或决策政策再重跑并冒充预注册。
- **洞哥 Grounding**：contract、design、payload、analysis 四根必须互相可追溯。
- **产品文明**：研究者看到的是 Seal → Run → Result，不需要手工维护散落配置。
- **UX / 设计文明**：tamper 与 unsupported 直接显示 `REJECTED_BEFORE_SCORE / BLOCKED`。
- **工程文明**：复用 Phase1E router，不复制 scorer。
- **测试文明**：正例、NIST、design tamper、payload tamper、unsupported 全覆盖。
- **Integration Court**：只有 registered route 与 executed route 完全一致且 fallback=false 才能 PASS。

## 5. 边界

这建立的是抗事后调参和抗结构漂移的分析治理层，不是未知自然规律或魔法的现实证据。

```text
externalRealityVerified = false
newNaturalLawVerified = false
magicVerified = false
```
