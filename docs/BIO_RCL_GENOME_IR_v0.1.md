# Bio-RCL Genome IR v0.1｜基因组研究中间表示

状态：`CANDIDATE / isolated local smoke PASS / full repository suite pending`

## 1. 为什么不是再造一个“生物学顶级域”

RCL Foundation 已经有：

- `genetic`：编码、表达、遗传、变化；
- `quantitative`：测量、置信度、不确定性；
- `knowledge`：可修订知识；
- `scientific`：假设、验证与复现；
- `causality-evidence`：因果—证据轴；
- `authority-boundary`：权限与边界轴。

因此基因组研究的当前缺口不是新增一个平行 Foundation Domain，而是补一层**序列级、坐标级、证据级、治理级的可执行中间表示**。

Genome IR v0.1 就是这层桥。

## 2. v0.1 的最小对象

一个 `rcl.genome-observation.v0.1` 记录表达一次可追溯的基因组观测：

```text
sampleRef
  + locus(reference assembly / contig / start / end)
  + variant(ref / alts / variant type)
  + genotype(alleles / phased / ploidy)
  + quality(score / filters / INFO)
  + evidence(source / accession / provenance / confidence)
  + claims(subject / predicate / object / status / evidence refs)
  + governance(access tier / consent basis / authority requirements)
  + Foundation binding
  -> observationRoot
```

`observationRoot` 使用 RCL 已有 canonical reality root 机制生成，因此同一规范化对象具有稳定内容根。

## 3. Foundation 映射

Genome IR 固定映射到：

```text
genetic
quantitative
knowledge
scientific
causality-evidence
authority-boundary
```

`genomeFoundationProjection()` 会将同一 rooted observation 投影成这些 RCL Foundation 面，而不会把 `ASSOCIATED`（相关）自动升级为 `CAUSAL`（因果）。

这是硬边界：**表示证据关系，不替研究者伪造因果关系。**

## 4. 数据治理不是附加功能

基因组本身具有高度可识别性，所以每条 observation 必须携带治理层：

- `public`：公开研究资源；
- `controlled`：受控访问数据；
- `private`：私人数据；
- `synthetic`：合成/测试数据；
- `unknown`：来源权限尚未确认。

默认 `subjectRisk` 为 `genomic-identifiability`，也就是“基因组可识别风险”。

这让后续研究系统可以在数据进入推理、训练、报告、导出之前执行 authority gate，而不是等到最后才补隐私判断。

## 5. VCF 第一条入口

`parseVcfVariantLine()` 已提供一个小型 VCF 记录入口，当前支持：

- 标准前 8 列；
- 单个样本的 `GT`；
- phased / unphased genotype；
- 多 ALT allele index；
- QUAL / FILTER / INFO；
- 自动生成来源证据记录；
- 直接进入 rooted Genome IR。

当前不是完整 VCF/BCF 引擎。大规模数据应该由专用 Provider 做流式解析，再逐条/分块 lower 到 Genome IR。

## 6. 下一阶段接入现有 RCL 研究器官

RCL 已经存在可复用研究器官，Genome IR 后续应接入而不是重造：

1. `Unknown Knowledge Compiler`：把尚无结论的变异/机制问题保持为 UNKNOWN candidate；
2. `Frontier Natural Law Lab`：把机制候选收束成可验证研究 lane；
3. `Knowledge Reality`：保存可修订的证据化 claim；
4. `Scientific Foundation`：承载实验、复现和反证；
5. `Evidence Ledger / Court`：保存来源、冲突、版本与验证结果。

目标流水线：

```text
FASTQ / BAM / CRAM / VCF / public dataset
  -> Provider normalization
  -> Genome IR
  -> Foundation projection
  -> UNKNOWN / hypothesis candidates
  -> evidence retrieval / experiment design
  -> revision / contradiction / replication
  -> evidence-bearing research artifact
```

## 7. v0.1 明确不做什么

- 不把统计相关包装成因果；
- 不把 consumer DNA report 当成事实层；
- 不内置疾病诊断结论；
- 不假装当前单条 variant 可以解释复杂人类能力；
- 不把私人/受控数据当公开数据；
- 不在核心里硬编码某个具体公共数据库。

公共数据库接入应作为 Provider / adapter，Genome IR 只冻结跨来源共同语义。

## 8. 当前验证

独立本地 smoke test 已覆盖：

- deterministic root；
- Foundation projection；
- association 不升级 causality；
- 缺失 evidence ref 拒绝；
- VCF genotype 解析；
- forged root 拒绝。

结果：`5/5 PASS`。

完整 RCL repository suite 尚待在完整 checkout 中执行，因此当前状态仍为 `CANDIDATE`，不能写成全仓验证通过。

## 9. v0.2 候选

优先级：

1. multi-sample VCF streaming provider；
2. reference-normalization / left-normalization contract；
3. structural variant 与 CNV 表示；
4. variant -> gene -> transcript -> protein -> pathway -> phenotype graph；
5. ClinVar / gnomAD / GWAS / GIAB / IGSR adapter contract；
6. controlled-access authority gate；
7. RNCS relation graph bridge；
8. Unknown Knowledge / Natural Law Lab 纵向研究闭环；
9. cohort-level aggregation IR；
10. phenotype / environment / longitudinal observation IR。
