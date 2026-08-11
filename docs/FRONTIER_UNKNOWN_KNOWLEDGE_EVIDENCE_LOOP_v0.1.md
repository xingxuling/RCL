# RCL Frontier Unknown Knowledge → Candidate Evidence Ledger → Evidence Court v0.1

**状态**：`CANDIDATE / implementation complete / executable repository run pending`  
**日期**：2026-08-11  
**基线**：Frontier Evidence Court / Candidate Tournament v0.1

## 0. 目标

Frontier Research Stack 已经能够对三条首发未知规律候选执行：实验规格、沙箱压力、不同 Design Grammar 的 scorer 与非补偿 Evidence Court。

本轮把更上游的 `Unknown Knowledge Compiler` 接进这条链：

```text
Unknown text / idea / anomaly
→ Unknown Knowledge Compiler
→ Candidate Evidence Ledger
→ Experiment-spec queue or existing Court lane
→ Sandbox / external evidence
→ Evidence Court
→ keep / repair / reject / replicate
```

关键原则：**Unknown Knowledge Compiler 的 promotion 只表示“值得进入研究流程”，绝不等于证据成立。**

## 1. 新模块

`src/frontier-candidate-evidence-ledger.mjs`

提供：

- `runUnknownKnowledgeEvidenceLoop()`
- `validateCandidateEvidenceLedger()`
- `appendCandidateEvidenceEvent()`

并从 `src/frontier-research-index.mjs` 导出。

## 2. 编译器 Gate 与 Evidence Rung 严格分离

Unknown Knowledge Compiler 已有自身结构化、可反证性、经验兼容性、盲预测准备度等 promotion gate。

本桥接层明确写死：

```text
compiler promoted
≠ sandbox survived
≠ external residual detected
≠ reproduced external candidate
≠ natural-law truth
```

一个 compiler-promoted 新候选在没有实验规格时只能进入：

```text
PROMOTED_AWAITING_EXPERIMENT_SPEC_AND_SANDBOX_ROUTE
Evidence Rung = R0
```

高 compiler score 不允许兑换 Evidence Court 的更高 rung。

## 3. Candidate Evidence Ledger

每个 candidate entry 至少绑定：

```text
candidateId
compilerCandidateRoot
compiler score
compiler lock score
prediction roots
explicit falsifiers
optional canonical lane binding
evidence rung
research disposition
append-only evidence events
entry root
```

Ledger 本身包含：

```text
compilerResultRoot
courtRoot
entries[]
queues
revision
root
```

所有 entry/event/ledger 都 root-bound。

## 4. 三类队列

### A. `promotedAwaitingExperimentSpec`

Unknown Knowledge Compiler 已晋升，但还没有对应实验规格/Design Grammar/sandbox suite。

下一门：

```text
candidate
→ measurable variables
→ null / ordinary alternatives
→ Design Grammar
→ scorer
→ sandbox suite
→ Court
```

### B. `courtManaged`

候选已经绑定现有 Frontier canonical lane，例如：

```text
spell_symbolic_control_protocol
formation_spatial_constraint_array
aether_substrate_information_medium
```

只有 **compiler promoted = true** 才允许进入 Court binding。

### C. `compilerRejected`

当前 Unknown Knowledge Compiler gate 未通过。

其含义仅为：

```text
REVISE_OR_ARCHIVE
```

不等于现实机制已被实验反证。

## 5. Evidence Event

`appendCandidateEvidenceEvent()` 提供 append-only evidence record。

典型事件：

```text
experiment_spec_created
sandbox_protocol_result
external_raw_dataset_received
replication_result
decisive_falsifier
research_note
```

事件本身不会偷偷升级 Evidence Court。若事件属于现实证据，应设置：

```text
externalEvidenceMayRequireCourtRerun = true
```

随后以正式 external evidence contract 重新执行 Court。

## 6. 非补偿规则

本模块固定：

```text
compilerPromotionDoesNotEqualSandboxSurvival = true
compilerScoreDoesNotEqualEvidenceRung = true
sandboxCannotReplaceExternalEvidence = true
decisiveExternalFalsifierOverridesLowerEvidence = true
evidenceEventsAreAppendOnlyAndRootBound = true
storyBasedRescueForbidden = true
```

## 7. Evidence boundary

所有输出继续固定：

```text
externalRealityVerified = false
newNaturalLawVerified = false
magicVerified = false
```

本模块只建立未知候选的自动研究治理链，不制造任何现实物理证据。

## 8. 自动测试

`tests/frontier-candidate-evidence-ledger.test.mjs` 当前包含 6 个逻辑检查：

1. compiler-promoted 新候选只进入 experiment-spec queue，不自动到 R1；
2. canonical promoted candidate 可绑定 Court，但 compiler score 不替代 Court rung；
3. compiler-rejected candidate 即使手工给 lane binding 也不能进入 Court；
4. append-only evidence event 会改变 ledger root 且保持可验证；
5. root seal 后篡改 entry 会被拒绝；
6. compiler → ledger → Court 全链证据边界保持 false。

在可执行 Node/CI 环境真正运行前，不把这些测试写成 PASS。

## 9. 下一门

下一阶段建议由 Work 模式做两件事：

### A. 先完成 canonical executable experiment campaign

运行所有 Frontier suites，并保存：

```text
stdout/stderr
Node version
OS / architecture
commit SHA
test counts
failure traces
Evidence Court summary
```

### B. 再做自动 Candidate Factory

把 `promotedAwaitingExperimentSpec` 中的新候选继续送入：

```text
Experiment Spec Compiler
→ Design Grammar inference
→ compatible scorer selection
→ sandbox scenario generator
→ Evidence Court registration
```

只有这样，Unknown Knowledge Compiler 才真正从“产生候选”升级成“持续科学候选演化入口”。
