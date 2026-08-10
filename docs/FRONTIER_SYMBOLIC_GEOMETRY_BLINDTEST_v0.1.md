# RCL Frontier Symbolic × Geometry Blindtest v0.1

**状态**：CANDIDATE / Phase0.5 computational blind discrimination stack  
**RCL 基线**：v0.94.0-alpha.1 + Frontier Natural Law Lab v0.1  
**日期**：2026-08-11

## 目标裁决

这一轮不再扩展“魔法是什么”的叙事，而是把 Frontier Natural Law Lab 中外部依赖最低的两条研究通道：

- `spell_symbolic_control_protocol`
- `formation_spatial_constraint_array`

压缩成第一个专用、可反证、预注册、盲测的数学-计算实验。

核心问题不是“符号和阵法有没有魔法”，而是：

> 在不泄露活跃条件语义的情况下，一个符号因子和一个空间约束因子是否存在**非加性的交互项**，并且检测器能否区分真正的交互、单独主效应、简单相加与共享漂移。

## 数学模型

预注册候选模型：

```text
y = β0 + βS·S + βG·G + βSG·(S×G) + nuisance + ε
```

零假设：

```text
H0: βSG = 0
```

零假设允许：

- 符号没有效应；
- 几何没有效应；
- 只有符号主效应；
- 只有几何主效应；
- 两者独立相加；
- 共享 session drift。

因此，单独的“符号有效”或“几何有效”都不会被误判成符号×几何耦合。

## 盲测协议

1. 在生成数据前冻结研究问题、候选模型、零假设、决定性残差和阈值；
2. 符号因子与几何因子的 active/control 语义分别随机映射为 blind level `0/1`；
3. evaluator 只获得匿名因子位、session 与 response，不得到 active level、scenario、注入参数或预期答案；
4. evaluator 比较五个嵌套模型：`H0`、symbol-main、geometry-main、additive、interaction；
5. 使用 BIC + difference-in-differences + 标准化交互强度共同裁决；
6. 完成 scoring 后才 reveal semantic mapping 和 scenario truth。

## 预注册判据

只有同时满足以下条件才判 `interaction detected`：

- `H_interaction` 为 BIC 最优模型；
- 相对 runner-up 的 BIC margin ≥ 2；
- `|difference-in-differences| ≥ 0.35`；
- standardized interaction ≥ 0.45；
- leakage score = 0。

阈值在 deck 生成前冻结。

## 压力场景

六个 synthetic scenarios：

1. `pure_null`
2. `symbol_main_only`
3. `geometry_main_only`
4. `additive_without_interaction`
5. `shared_session_drift`
6. `injected_symbol_geometry_interaction`

前五项必须拒绝交互，最后一项必须检测交互。

## 实际结果

```text
scenario count: 6
correct classifications: 6/6
pass rate: 1.0
all negative controls rejected: true
injected positive detected: true
leakage free: true
externalRealityVerified: false
```

注入交互场景：

```text
winner = H_interaction
BIC margin = 2.778148887
|interaction delta| = 0.797042268
standardized interaction = 0.721453551
```

压力套件根：

```text
10fcfe3b2ec32d6c9afb7258e5330041fb3407e6dbff15117f10177b0f6a6e2e
```

预注册根：

```text
7f50bc89882be1d7ffc5bcd3cfbefbed7b788510dfe134c1eeedff872192c73f
```

## 多文明联邦审查

- **Founder Twin**：把“法术×阵法”重命名为“符号控制 × 空间约束的非加性交互识别问题”。
- **柳清莲 Gate**：禁止从 synthetic positive control 推导现实中的魔法存在。
- **洞哥 Grounding**：决定性残差必须在普通主效应、加性模型和共享漂移之后仍成立。
- **产品文明**：当前产物面向研究者，不做大众化“魔法检测器”包装。
- **UX / 设计文明**：结果只显示 preregistration、blind score、reveal、negative-control matrix 和 next gate。
- **工程文明**：复用 Frontier Natural Law Lab 的 lane roots，不另造独立研究体系。
- **代码文明**：盲 evaluator 不读取 sealed truth；factor semantics 只在 scoring 后 reveal。
- **测试文明**：要求 6/6 synthetic pressure classification、determinism、zero leakage 和 report closure。
- **安全文明**：当前只运行数学/计算实验；不发起人体、材料、能量或其他物理实验。
- **发布文明**：交付源码、预注册、压力结果、redacted deck、blind score、reveal 与 RCL projection。
- **Integration Court**：只有 `externalRealityVerified=false` 且全部 synthetic controls 正确分类时才允许 Phase0.5 PASS。
- **Evidence Ledger**：根绑定 preregistration → redacted deck → blind score → reveal。

## 下一门：Phase1A

下一步不是继续制造更漂亮的 synthetic signal，而是建立**真实数据接口但不预设存在新物理**：

1. `ExternalObservationContract v0.1`：定义真实传感器/公开数据/仪器数据的 schema、时间戳、校准、来源与不可修改区；
2. 将 active/control 语义交给独立 randomization manifest，而不是研究运行时；
3. evaluator 在 reveal 前只能读取匿名数据；
4. 先跑普通软件/硬件已知效应作为真实世界 positive control；
5. 再允许未知自然规律候选进入同一盲测管线；
6. 任何 null 结果都进入 Evidence Ledger，不以“魔法没触发”为理由删除。

**边界**：v0.1 证明的是盲测判别协议能在合成数据中区分 interaction 与 preregistered controls，不证明现实中存在符号×空间的新自然效应。
