# Bio-RCL Genomics Federation v0.2｜基因组联邦研究栈

状态：`CANDIDATE / implementation staged across RCL + RNCS + UGIS + DWAC + USCE / repository suites pending`

## 1. 当前不再是“DNA 报告生成器”

这一阶段把 v0.1 的单条 Genome IR 扩成一条可治理、可追溯、可继续研究的联邦链：

```text
公开数据源 / 受控数据源
  -> 成熟开源生信 Provider
  -> RCL Genome IR
  -> RCL Genome Knowledge Graph
  -> RNCS evidence proposal
  -> USCE unknown framing
  -> UGIS minimum-sufficient research route
  -> DWAC source-bound genomics artifact
```

每层保留自己的语义所有权，不把所有能力塞进一个“万能 DNA Agent”。

## 2. RCL 新增的三个核心层

### 2.1 Provider / Source Contract

`genome-provider-contract.mjs` 冻结公共数据源与工具边界：

- GIAB：benchmark reference；
- IGSR / 1000 Genomes：population reference；
- gnomAD：population frequency；
- GWAS Catalog：association evidence；
- ClinVar：submitted variant interpretation evidence。

重型文件处理不在 RCL 内重写。当前候选开源 Provider：

- htslib：SAM/BAM/CRAM/VCF/BCF I/O；
- bcftools：variant normalization/query；
- pysam / cyvcf2：Python 数据流接入；
- Ensembl VEP：gene/transcript consequence annotation。

RCL 只冻结 Provider capability、authority、receipt 和 lowering contract。

### 2.2 Genome Knowledge Graph

Genome IR 表示“观测”；Genome Knowledge Graph 表示“观测之间以及生物实体之间的证据关系”。

当前实体：

```text
sample / variant / genomic-feature / gene / transcript / protein /
pathway / phenotype / population / study / evidence / dataset
```

当前关系包括：

```text
observed-in
maps-to-gene
transcript-consequence
encodes
participates-in
associated-with
supports / contradicts
causes
```

其中有一条硬边界：

```text
associated-with != causes
```

`CAUSAL` 必须显式使用 `causes` edge，并同时携带：

- evidenceRefs；
- causalBasis。

普通 trait association 即便上游误标为 CAUSAL，lowering 也会降回 ASSOCIATED，直到独立因果证据满足显式 causal edge contract。

### 2.3 Public Study Bootstrap

`genome-study-bootstrap.mjs` 把第一次真实公开人类基因组研究固定成 **manifest-first**：先拿目录、索引、范围和版本，再决定是否下载大数据。

默认第一样本：

```text
HG005 / NA24631 son
GIAB Chinese Trio
GRCh38
NIST v4.2.1 benchmark
public
```

第一阶段默认禁止整个全基因组盲下载；先跑 bounded VCF slice，验证从真实数据到最终研究工件的完整语义链。

## 3. 联邦所有权

| 层 | 所有权 |
|---|---|
| 数据/变异/证据/authority 语义 | RCL |
| rooted evidence graph / proposal runtime | RNCS |
| open unknown framing / capability gap | USCE |
| minimum-sufficient research route / stop rule | UGIS |
| reader-facing research artifact | DWAC |
| 文件解析、标准化、注释 | 外部成熟生信 Provider |

特别修正：USCE 不再拥有“下一实验排名”。USCE 负责识别未知、能力缺口和联邦 handoff；研究路线排序属于 UGIS research projection。

## 4. RNCS 图层

RNCS 新增 Genome Knowledge Graph bridge 后，输入不再只是单条 variant observation。

它会把：

```text
entity
relation
source evidence
causal basis
access tier
```

lower 到 RNCS evidence nodes / edges，并产生 proposal-only 的 evidence transition。

默认状态必须仍为：

```text
phase = proposed
authority = pending
commit = not_committed
```

RNCS 不允许根据“图看起来合理”自行 authorize 或 commit。

## 5. UGIS Research Projection

UGIS 不判断某个生物学结论是真是假；它选择“下一步做什么最划算且足够”。

路线依次通过：

```text
Authority
-> Reachability
-> Constraint
-> Resolution Sufficiency
-> Projection Ranking
-> Stop Rule
```

当前候选动作示例：

- population frequency check；
- independent association replication；
- functional annotation；
- authorized controlled cohort analysis；
- mechanism experiment。

ranking 明确考虑：

```text
expected information gain
replication value
causal discrimination
cost
time cost
privacy risk
uncertainty coverage
```

它是研究路线启发式，不是生物真理分数。

## 6. DWAC 不允许“从图脑补论文”

Genome Knowledge Graph 进入 DWAC 前会变成 `GroundedBrief` source：

```text
genome-knowledge-graph:<graphRoot>
```

relation/evidence/access-tier metadata 一并保留。

DWAC 可以综合：

- 数据与样本；
- 变异与 QC；
- annotation；
- statistical evidence；
- mechanism candidate；
- confounders；
- replication / falsifier；
- governance；
- limitations；
- next experiment。

但不能创造源图里不存在的证据引用，也不能把 association 写成 causal truth。

## 7. 第一条真实世界线

当前建议第一条完整 worldline：

```text
GIAB HG005 benchmark manifest
  -> bounded GRCh38 VCF slice
  -> htslib/bcftools normalization
  -> Genome IR observations
  -> VEP annotation bundle
  -> Genome Knowledge Graph
  -> IGSR/gnomAD population context
  -> GWAS association context
  -> ClinVar interpretation context (if relevant)
  -> RNCS candidate evidence proposal
  -> USCE unknown framing
  -> UGIS next action
  -> DWAC genomics research report
```

只有这一条公开样本链能够稳定 replay 后，才值得把私人 WGS 加进系统。

## 8. 当前明确未证明

本轮代码与测试已写入分支，但当前聊天执行环境没有这些私人仓库的本地 checkout，并且外部 git clone 网络不可用。因此：

- 没有声称全仓测试通过；
- 没有声称跨仓 integration test 已执行；
- 没有使用 GitHub Actions；
- 没有下载 HG005 的大体积测序数据；
- 没有进行任何医学诊断；
- 没有 canonical promotion。

下一门槛不是继续写更多概念，而是让真实 HG005 bounded dataset 跑通一条本地/可重放的 provider pipeline。
